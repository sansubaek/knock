-- knock DB 보강 (schema.sql 다음에 한 번 실행)
-- schema.sql을 이미 실행했어도, 아직 안 했어도 순서만 지키면 된다: schema.sql → 002_보강.sql
-- 여러 번 실행해도 문제없게 만들었다.

-- ─────────────────────────────────────────
-- 1. 보안 수정: 방문자 페이지 조회 함수를 서버만 부를 수 있게
--    (전에는 누구나 Supabase에 직접 호출해서 암호 4자리를 무한 대입할 수 있었다)
-- ─────────────────────────────────────────
revoke execute on function public.get_public_page(text, text) from public, anon, authenticated;
grant execute on function public.get_public_page(text, text) to service_role;

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
language plpgsql security definer set search_path = public as $$
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
language sql security definer set search_path = public as $$
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
create or replace function public.get_public_page(p_qr_id text, p_pin text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
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
  if p.visibility = 'locked'
     and (p_pin is null or p.lock_pin_hash is null or crypt(p_pin, p.lock_pin_hash) <> p.lock_pin_hash) then
    return jsonb_build_object('state', 'locked', 'line', p.line);
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
revoke execute on function public.get_public_page(text, text) from public, anon, authenticated;
grant execute on function public.get_public_page(text, text) to service_role;

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
language plpgsql security definer set search_path = public as $$
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

create index if not exists scan_logs_scanned_idx on public.scan_logs (scanned_at desc);
