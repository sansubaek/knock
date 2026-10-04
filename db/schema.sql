-- knock DB 스키마 (Supabase / Postgres)
-- Supabase 대시보드 > SQL Editor에서 순서대로 실행

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────
-- 1. 테이블
-- ─────────────────────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text check (char_length(nickname) <= 20),
  role        text not null default 'user' check (role in ('user','admin')),
  is_over_14  boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.pages (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  line           text not null check (line in ('bang','dot')),
  template       text not null default 'basic',
  theme          jsonb not null default '{}'::jsonb,
  visibility     text not null default 'public' check (visibility in ('public','link','locked','private')),
  lock_pin_hash  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null default 'beta' check (kind in ('beta','preorder','order')),
  user_id         uuid references public.profiles(id) on delete set null,
  applicant_name  text not null check (char_length(applicant_name) <= 30),
  contact         text not null check (char_length(contact) <= 80),
  line            text not null check (line in ('bang','dot')),
  design          text check (char_length(design) <= 60),
  phone_model     text check (char_length(phone_model) <= 40),
  status          text not null default 'received'
                  check (status in ('received','requested','producing','shipped','activated','canceled')),
  admin_memo      text,
  created_at      timestamptz not null default now()
);

-- QR ID: 헷갈리는 글자(0 O 1 I L) 뺀 대문자+숫자 6~8자리
create table public.qr_codes (
  id               text primary key check (id ~ '^[A-HJKMNP-Z2-9]{6,8}$'),
  line             text not null check (line in ('bang','dot')),
  status           text not null default 'issued' check (status in ('issued','printed','active','retired')),
  lost_mode        boolean not null default false,
  code_hmac        text not null,
  code_used_at     timestamptz,
  failed_attempts  int not null default 0,
  locked_until     timestamptz,
  owner_id         uuid references public.profiles(id) on delete set null,
  page_id          uuid references public.pages(id) on delete set null,
  order_id         uuid references public.orders(id) on delete set null,
  created_at       timestamptz not null default now()
);

create table public.blocks (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references public.pages(id) on delete cascade,
  type        text not null check (char_length(type) between 1 and 30),
  position    int not null default 0,
  is_visible  boolean not null default true,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table public.decor_items (
  id        uuid primary key default gen_random_uuid(),
  page_id   uuid not null references public.pages(id) on delete cascade,
  item_key  text not null,
  x         real not null default 0,
  y         real not null default 0,
  rotation  real not null default 0,
  scale     real not null default 1,
  z         int  not null default 0
);

create table public.guestbook_entries (
  id            uuid primary key default gen_random_uuid(),
  page_id       uuid not null references public.pages(id) on delete cascade,
  nickname      text not null check (char_length(nickname) between 1 and 12),
  message       text not null check (char_length(message) between 1 and 200),
  status        text not null default 'visible' check (status in ('visible','pending','hidden')),
  visitor_hash  text,
  created_at    timestamptz not null default now()
);

create table public.knocks (
  id            bigint generated always as identity primary key,
  page_id       uuid not null references public.pages(id) on delete cascade,
  visitor_hash  text,
  created_at    timestamptz not null default now()
);

create table public.received_cards (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references public.pages(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 30),
  org         text check (char_length(org) <= 40),
  contact     text not null check (char_length(contact) between 1 and 60),
  memo        text check (char_length(memo) <= 60),
  created_at  timestamptz not null default now()
);

create table public.lost_messages (
  id              uuid primary key default gen_random_uuid(),
  qr_id           text not null references public.qr_codes(id) on delete cascade,
  message         text not null check (char_length(message) between 1 and 300),
  finder_contact  text check (char_length(finder_contact) <= 60),
  location_note   text check (char_length(location_note) <= 100),
  created_at      timestamptz not null default now()
);

create table public.scan_logs (
  id            bigint generated always as identity primary key,
  qr_id         text not null references public.qr_codes(id) on delete cascade,
  scanned_at    timestamptz not null default now(),
  visitor_hash  text,
  is_owner      boolean not null default false,
  user_agent    text,
  result        text check (result in ('activate','page','locked','private','lost'))
);

create table public.inquiries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete set null,
  email        text not null check (char_length(email) <= 120),
  type         text not null check (type in ('general','code','report','lost','other')),
  target_type  text,
  target_id    text,
  body         text not null check (char_length(body) between 1 and 2000),
  status       text not null default 'open' check (status in ('open','answered','closed')),
  reply        text,
  replied_at   timestamptz,
  created_at   timestamptz not null default now()
);

create table public.admin_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  target      text,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- 2. 인덱스
-- ─────────────────────────────────────────

create index on public.pages (owner_id);
create index on public.qr_codes (owner_id);
create index on public.qr_codes (order_id);
create index on public.blocks (page_id, position);
create index on public.decor_items (page_id);
create index on public.guestbook_entries (page_id, created_at desc);
create index on public.knocks (page_id);
create index on public.received_cards (page_id, created_at desc);
create index on public.lost_messages (qr_id, created_at desc);
create index on public.scan_logs (qr_id, scanned_at desc);
create index on public.orders (status, created_at desc);
create index on public.inquiries (status, created_at desc);

-- ─────────────────────────────────────────
-- 3. 함수와 트리거
-- ─────────────────────────────────────────

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.owns_page(p_page_id uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.pages where id = p_page_id and owner_id = auth.uid());
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pages_touch before update on public.pages
  for each row execute function public.touch_updated_at();

-- 암호 잠금 PIN 설정 (주인만)
create or replace function public.set_page_pin(p_page_id uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.owns_page(p_page_id) then
    raise exception 'not owner';
  end if;
  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'pin must be 4-6 digits';
  end if;
  update public.pages
     set lock_pin_hash = crypt(p_pin, gen_salt('bf')), visibility = 'locked'
   where id = p_page_id;
end;
$$;

-- 방문자용 페이지 조회. QR을 찍은 사람은 테이블에 직접 접근하지 않고 이것만 부른다.
-- PIN 시도 횟수 제한은 이 함수를 부르는 서버 라우트에서 한다.
create or replace function public.get_public_page(p_qr_id text, p_pin text default null)
returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  q public.qr_codes%rowtype;
  p public.pages%rowtype;
begin
  select * into q from public.qr_codes where id = p_qr_id;
  if not found or q.status = 'retired' then
    return jsonb_build_object('state', 'not_found');
  end if;
  if q.status in ('issued','printed') or q.page_id is null then
    return jsonb_build_object('state', 'activate', 'line', q.line);
  end if;
  if q.lost_mode then
    return jsonb_build_object('state', 'lost', 'line', q.line);
  end if;

  select * into p from public.pages where id = q.page_id;
  if p.visibility = 'private' then
    return jsonb_build_object('state', 'private');
  end if;
  if p.visibility = 'locked'
     and (p_pin is null or p.lock_pin_hash is null or crypt(p_pin, p.lock_pin_hash) <> p.lock_pin_hash) then
    return jsonb_build_object('state', 'locked');
  end if;

  return jsonb_build_object(
    'state', 'page',
    'line', p.line,
    'template', p.template,
    'theme', p.theme,
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'type', b.type, 'data', b.data) order by b.position)
      from public.blocks b where b.page_id = p.id and b.is_visible), '[]'::jsonb),
    'decor', coalesce((
      select jsonb_agg(jsonb_build_object('item', d.item_key, 'x', d.x, 'y', d.y,
                                          'rotation', d.rotation, 'scale', d.scale, 'z', d.z))
      from public.decor_items d where d.page_id = p.id), '[]'::jsonb),
    'guestbook', coalesce((
      select jsonb_agg(jsonb_build_object('nickname', g.nickname, 'message', g.message, 'at', g.created_at))
      from (select * from public.guestbook_entries
             where page_id = p.id and status = 'visible'
             order by created_at desc limit 20) g), '[]'::jsonb),
    'knock_count', (select count(*) from public.knocks k where k.page_id = p.id)
  );
end;
$$;

revoke all on function public.get_public_page(text, text) from public;
grant execute on function public.get_public_page(text, text) to anon, authenticated;
revoke all on function public.set_page_pin(uuid, text) from public;
grant execute on function public.set_page_pin(uuid, text) to authenticated;

-- ─────────────────────────────────────────
-- 4. RLS (모든 테이블 켜기)
-- ─────────────────────────────────────────

alter table public.profiles          enable row level security;
alter table public.pages             enable row level security;
alter table public.orders            enable row level security;
alter table public.qr_codes          enable row level security;
alter table public.blocks            enable row level security;
alter table public.decor_items       enable row level security;
alter table public.guestbook_entries enable row level security;
alter table public.knocks            enable row level security;
alter table public.received_cards    enable row level security;
alter table public.lost_messages     enable row level security;
alter table public.scan_logs         enable row level security;
alter table public.inquiries         enable row level security;
alter table public.admin_logs        enable row level security;

-- 관리자는 전부 접근
create policy admin_all on public.profiles          for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.pages             for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.orders            for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.qr_codes          for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.blocks            for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.decor_items       for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.guestbook_entries for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.knocks            for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.received_cards    for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.lost_messages     for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.scan_logs         for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.inquiries         for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.admin_logs        for all using (public.is_admin()) with check (public.is_admin());

-- profiles: 내 것만 보고, 닉네임·연령확인만 수정 (role은 못 바꿈)
create policy own_select on public.profiles for select using (id = auth.uid());
create policy own_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (nickname, is_over_14) on public.profiles to authenticated;

-- pages / blocks / decor: 주인만
create policy own_all on public.pages for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy own_all on public.blocks for all
  using (public.owns_page(page_id)) with check (public.owns_page(page_id));
create policy own_all on public.decor_items for all
  using (public.owns_page(page_id)) with check (public.owns_page(page_id));

-- 방명록: 주인은 보고, 숨기고, 지울 수 있음. 작성은 서버 라우트에서만.
create policy own_select on public.guestbook_entries for select using (public.owns_page(page_id));
create policy own_update on public.guestbook_entries for update
  using (public.owns_page(page_id)) with check (public.owns_page(page_id));
create policy own_delete on public.guestbook_entries for delete using (public.owns_page(page_id));

-- 노크·받은 명함: 주인만 조회 (작성은 서버)
create policy own_select on public.knocks for select using (public.owns_page(page_id));
create policy own_select on public.received_cards for select using (public.owns_page(page_id));
create policy own_delete on public.received_cards for delete using (public.owns_page(page_id));

-- QR: 내 QR만 조회. 코드 해시는 아예 못 읽게 컬럼 권한으로 막음. 분실 모드만 직접 켜고 끔.
create policy own_select on public.qr_codes for select using (owner_id = auth.uid());
create policy own_update on public.qr_codes for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke select, update on public.qr_codes from authenticated, anon;
grant select (id, line, status, lost_mode, code_used_at, failed_attempts, locked_until, owner_id, page_id, order_id, created_at) on public.qr_codes to authenticated;
grant update (lost_mode) on public.qr_codes to authenticated;

-- 분실 메시지·스캔 로그: 그 QR 주인만 조회 (작성은 서버)
create policy own_select on public.lost_messages for select
  using (exists (select 1 from public.qr_codes q where q.id = qr_id and q.owner_id = auth.uid()));
create policy own_select on public.scan_logs for select
  using (exists (select 1 from public.qr_codes q where q.id = qr_id and q.owner_id = auth.uid()));

-- 주문·문의: 내가 낸 것만 조회 (작성은 서버)
create policy own_select on public.orders for select using (user_id = auth.uid());
create policy own_select on public.inquiries for select using (user_id = auth.uid());

-- ─────────────────────────────────────────
-- 5. 사진 저장소
-- ─────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('page-media', 'page-media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'page-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_update on storage.objects for update to authenticated
  using (bucket_id = 'page-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'page-media' and (storage.foldername(name))[1] = auth.uid()::text);
