-- knock DB 보강 (schema.sql 다음에 한 번 실행)
-- schema.sql을 이미 실행했어도, 아직 안 했어도 순서만 지키면 된다: schema.sql → 002_보강.sql
-- 여러 번 실행해도 문제없게 만들었다.

-- ─────────────────────────────────────────
-- 1. 보안 수정: 방문자 페이지 조회 함수를 서버만 부를 수 있게
--    (전에는 누구나 Supabase에 직접 호출해서 암호 4자리를 무한 대입할 수 있었다)
-- ─────────────────────────────────────────
--    (아래 4번에서 새 함수로 바꾸고 옛 함수는 지운다)
do $$ begin
  if to_regprocedure('public.get_public_page(text,text)') is not null then
    revoke execute on function public.get_public_page(text, text) from public, anon, authenticated;
  end if;
end $$;

-- ─────────────────────────────────────────
-- 2. 시도 횟수 제한용 표 (암호, 코드, 방명록, 폼 도배 방지). 서버만 사용
-- ─────────────────────────────────────────
create table if not exists public.rate_limits (
  key       text primary key,
  count     int not null default 0,
  reset_at  timestamptz not null
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- 허용 범위 안이면 true, 넘으면 false
create or replace function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare c int;
begin
  insert into public.rate_limits as r (key, count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update set
    count    = case when r.reset_at < now() then 1 else r.count + 1 end,
    reset_at = case when r.reset_at < now() then now() + make_interval(secs => p_window_seconds) else r.reset_at end
  returning count into c;
  return c <= p_limit;
end;
$$;
revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

-- 오래된 기록 정리 (가끔 SQL Editor에서 실행하거나 cron으로)
create or replace function public.cleanup_rate_limits() returns void
language sql security definer set search_path = public, extensions as $$
  delete from public.rate_limits where reset_at < now() - interval '1 day';
$$;
revoke execute on function public.cleanup_rate_limits() from public, anon, authenticated;
grant execute on function public.cleanup_rate_limits() to service_role;

-- ─────────────────────────────────────────
-- 3. 칸 추가
-- ─────────────────────────────────────────
-- 방명록 방식: open(바로 공개) / approval(내가 승인해야 공개) / off(방명록 끄기)
alter table public.pages add column if not exists guestbook_mode text not null default 'open';
do $$ begin
  alter table public.pages add constraint pages_guestbook_mode_chk check (guestbook_mode in ('open','approval','off'));
exception when duplicate_object then null; end $$;

-- 분실 모드일 때 습득자에게 보여줄 한마디 (예: "찾아주시면 사례할게요")
alter table public.qr_codes add column if not exists lost_note text;
do $$ begin
  alter table public.qr_codes add constraint qr_codes_lost_note_chk check (char_length(lost_note) <= 200);
exception when duplicate_object then null; end $$;
grant select (lost_note) on public.qr_codes to authenticated;
grant update (lost_note) on public.qr_codes to authenticated;

-- 블록 하나에 너무 큰 데이터가 들어가지 않게 (16KB)
do $$ begin
  alter table public.blocks add constraint blocks_data_size_chk check (pg_column_size(data) <= 16384);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.pages add constraint pages_theme_size_chk check (pg_column_size(theme) <= 4096);
exception when duplicate_object then null; end $$;

-- 주인이 페이지 하나에 블록을 너무 많이 만들지 못하게 (40개)
create or replace function public.limit_blocks() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.blocks where page_id = new.page_id) >= 40 then
    raise exception 'too many blocks';
  end if;
  return new;
end;
$$;
drop trigger if exists blocks_limit on public.blocks;
create trigger blocks_limit before insert on public.blocks
  for each row execute function public.limit_blocks();

create or replace function public.limit_decor() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.decor_items where page_id = new.page_id) >= 30 then
    raise exception 'too many decor items';
  end if;
  return new;
end;
$$;
drop trigger if exists decor_limit on public.decor_items;
create trigger decor_limit before insert on public.decor_items
  for each row execute function public.limit_decor();

-- ─────────────────────────────────────────
-- 4. 방문자 페이지 조회 함수 갱신
--    분실 한마디, 방명록 방식, 오늘 방문자 수를 같이 돌려준다
-- ─────────────────────────────────────────
-- p_unlocked: 서버가 이미 암호를 확인한 방문자(서명된 쿠키)면 true
create or replace function public.get_public_page(p_qr_id text, p_pin text default null, p_unlocked boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  q public.qr_codes%rowtype;
  p public.pages%rowtype;
  today_start timestamptz := (date_trunc('day', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
begin
  select * into q from public.qr_codes where id = p_qr_id;
  if not found or q.status = 'retired' then
    return jsonb_build_object('state', 'not_found');
  end if;
  if q.status in ('issued','printed') or q.page_id is null then
    return jsonb_build_object('state', 'activate', 'line', q.line);
  end if;
  if q.lost_mode then
    return jsonb_build_object('state', 'lost', 'line', q.line, 'lost_note', q.lost_note);
  end if;

  select * into p from public.pages where id = q.page_id;
  if p.visibility = 'private' then
    return jsonb_build_object('state', 'private', 'line', p.line);
  end if;
  if p.visibility = 'locked' and not coalesce(p_unlocked, false)
     and (p_pin is null or p.lock_pin_hash is null or crypt(p_pin, p.lock_pin_hash) <> p.lock_pin_hash) then
    return jsonb_build_object('state', 'locked', 'line', p.line, 'page_id', p.id);
  end if;

  return jsonb_build_object(
    'state', 'page',
    'page_id', p.id,
    'line', p.line,
    'template', p.template,
    'theme', p.theme,
    'guestbook_mode', p.guestbook_mode,
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'type', b.type, 'data', b.data) order by b.position)
      from public.blocks b where b.page_id = p.id and b.is_visible), '[]'::jsonb),
    'decor', coalesce((
      select jsonb_agg(jsonb_build_object('item', d.item_key, 'x', d.x, 'y', d.y,
                                          'rotation', d.rotation, 'scale', d.scale, 'z', d.z) order by d.z)
      from public.decor_items d where d.page_id = p.id), '[]'::jsonb),
    'guestbook', case when p.guestbook_mode = 'off' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('nickname', g.nickname, 'message', g.message, 'at', g.created_at))
      from (select * from public.guestbook_entries
             where page_id = p.id and status = 'visible'
             order by created_at desc limit 20) g), '[]'::jsonb) end,
    'knock_count', (select count(*) from public.knocks k where k.page_id = p.id),
    'today_visits', (select count(distinct s.visitor_hash) from public.scan_logs s
                      join public.qr_codes qq on qq.id = s.qr_id
                     where qq.page_id = p.id and s.scanned_at >= today_start and not s.is_owner),
    'total_visits', (select count(*) from public.scan_logs s
                      join public.qr_codes qq on qq.id = s.qr_id
                     where qq.page_id = p.id and not s.is_owner)
  );
end;
$$;
drop function if exists public.get_public_page(text, text);
revoke execute on function public.get_public_page(text, text, boolean) from public, anon, authenticated;
grant execute on function public.get_public_page(text, text, boolean) to service_role;

-- ─────────────────────────────────────────
-- 5. 서버가 쓰는 권한 확인 (Supabase는 service_role에 기본으로 다 열려 있다. 로컬 테스트용)
-- ─────────────────────────────────────────
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema public to service_role;
    grant all on all tables in schema public to service_role;
    grant all on all sequences in schema public to service_role;
  end if;
end $$;

-- ─────────────────────────────────────────
-- 6. 베타 지표용: 페이지를 언제 고쳤는지 기록 (가설 1 "계속 업데이트하나" 측정)
--    같은 페이지는 10분에 한 번만 남긴다
-- ─────────────────────────────────────────
create table if not exists public.page_edits (
  id         bigint generated always as identity primary key,
  page_id    uuid not null references public.pages(id) on delete cascade,
  edited_at  timestamptz not null default now()
);
create index if not exists page_edits_page_idx on public.page_edits (page_id, edited_at desc);
alter table public.page_edits enable row level security;
drop policy if exists admin_all on public.page_edits;
create policy admin_all on public.page_edits for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists own_select on public.page_edits;
create policy own_select on public.page_edits for select using (public.owns_page(page_id));

create or replace function public.log_page_edit() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.page_edits where page_id = new.id and edited_at > now() - interval '10 minutes') then
    insert into public.page_edits (page_id) values (new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists pages_log_edit on public.pages;
create trigger pages_log_edit after update on public.pages
  for each row execute function public.log_page_edit();

-- ─────────────────────────────────────────
-- 7. 보안 리뷰 반영 (10/4)
-- ─────────────────────────────────────────
-- 시도 횟수를 늘리지 않고 지금 몇 번인지만 보기
create or replace function public.rate_limit_count(p_key text) returns int
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select count from public.rate_limits where key = p_key and reset_at >= now()), 0);
$$;
revoke execute on function public.rate_limit_count(text) from public, anon, authenticated;
grant execute on function public.rate_limit_count(text) to service_role;

-- 코드 틀린 횟수를 한 번에 +1 (관리자 화면 표시용)
create or replace function public.bump_failed_attempts(p_id text) returns void
language sql security definer set search_path = public, extensions as $$
  update public.qr_codes set failed_attempts = failed_attempts + 1 where id = p_id;
$$;
revoke execute on function public.bump_failed_attempts(text) from public, anon, authenticated;
grant execute on function public.bump_failed_attempts(text) to service_role;

-- 주인은 방명록의 보이기/숨기기만 바꿀 수 있다 (글 내용은 못 고침)
revoke update on public.guestbook_entries from anon, authenticated;
grant update (status) on public.guestbook_entries to authenticated;

-- 신청자는 자기 신청을 볼 수 있지만 관리자 메모는 못 본다
revoke select on public.orders from anon, authenticated;
grant select (id, kind, user_id, applicant_name, contact, line, design, phone_model, status, created_at) on public.orders to authenticated;

-- 사진은 케이스를 등록한 회원만, 1인당 200장까지
create or replace function public.media_count(p_uid uuid) returns int
language sql stable security definer set search_path = public, storage as $$
  select count(*)::int from storage.objects o where o.bucket_id = 'page-media' and (storage.foldername(o.name))[1] = p_uid::text;
$$;
revoke execute on function public.media_count(uuid) from public, anon;
grant execute on function public.media_count(uuid) to authenticated;
drop policy if exists media_insert on storage.objects;
create policy media_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'page-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.qr_codes q where q.owner_id = auth.uid() and q.status = 'active')
    and public.media_count(auth.uid()) < 200
  );

-- 편집기 저장을 한 번에 (중간에 실패하면 전부 취소돼서 내용이 날아가지 않는다)
-- security invoker: 호출한 사람 권한(RLS)으로 실행되므로 남의 페이지는 못 고친다
create or replace function public.save_page(p_page_id uuid, p_blocks jsonb, p_removed uuid[], p_page jsonb, p_decor jsonb)
returns void
language plpgsql security invoker set search_path = public, extensions as $$
declare
  b jsonb;
  d jsonb;
  i int := 0;
  vis text := p_page->>'visibility';
begin
  if not public.owns_page(p_page_id) then
    raise exception 'not owner';
  end if;
  if p_removed is not null and array_length(p_removed, 1) > 0 then
    delete from public.blocks where page_id = p_page_id and id = any(p_removed);
  end if;
  for b in select * from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) loop
    insert into public.blocks (id, page_id, type, position, is_visible, data)
    values ((b->>'id')::uuid, p_page_id, b->>'type', i, coalesce((b->>'is_visible')::boolean, true), coalesce(b->'data', '{}'::jsonb))
    on conflict (id) do update
      set type = excluded.type, position = excluded.position, is_visible = excluded.is_visible, data = excluded.data
      where public.blocks.page_id = p_page_id;
    i := i + 1;
  end loop;
  update public.pages set
    template = coalesce(p_page->>'template', template),
    theme = coalesce(p_page->'theme', theme),
    guestbook_mode = coalesce(p_page->>'guestbook_mode', guestbook_mode),
    visibility = case
      when vis is null then visibility
      when vis = 'locked' and lock_pin_hash is null then visibility
      else vis end
  where id = p_page_id;
  delete from public.decor_items where page_id = p_page_id;
  i := 0;
  for d in select * from jsonb_array_elements(coalesce(p_decor, '[]'::jsonb)) loop
    insert into public.decor_items (page_id, item_key, x, y, rotation, scale, z)
    values (p_page_id, d->>'item', (d->>'x')::real, (d->>'y')::real, coalesce((d->>'rotation')::real, 0), coalesce((d->>'scale')::real, 1), i);
    i := i + 1;
  end loop;
end;
$$;
revoke execute on function public.save_page(uuid, jsonb, uuid[], jsonb, jsonb) from public, anon;
grant execute on function public.save_page(uuid, jsonb, uuid[], jsonb, jsonb) to authenticated;

create index if not exists scan_logs_scanned_idx on public.scan_logs (scanned_at desc);

-- ─────────────────────────────────────────
-- 8. Supabase 보안 점검(Security Advisor) 반영
-- ─────────────────────────────────────────
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_page_edit() from public, anon, authenticated;
revoke execute on function public.set_page_pin(uuid, text) from public, anon;
grant execute on function public.set_page_pin(uuid, text) to authenticated;
alter function public.touch_updated_at() set search_path = public;
alter function public.limit_blocks() set search_path = public;
alter function public.limit_decor() set search_path = public;
