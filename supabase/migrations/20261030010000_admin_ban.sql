-- =====================================================================
-- 관리자 내보내기(차단)
-- ⚠ 개발용 Silent Chapel Supabase 프로젝트에서만 실행하세요. 20261030000000_overflow_rooms.sql 다음에 실행합니다.
--
-- 흐름
--   1) 관리자 비밀번호를 SQL 로 한 번 정함 (아래 '비밀번호 정하기', 해시로만 저장)
--   2) 앱 설정 → 관리자 → 비밀번호 입력 → claim_admin() 이 그 기기의 익명 사용자를 관리자로 등록
--   3) 관리자가 '함께 있는 사람' 목록에서 내보내기 → ban_user()
--      · 차단 목록에 넣고 방 세션을 지움 → 다시 들어오려 하면 join_room 이 'banned' 로 거절
--      · 같은 방 사람들에게 알림을 보내면, 각 앱이 is_banned()/am_i_banned() 로 서버에 확인한 뒤
--        그 사람을 숨기거나(다른 사람) 연결을 끊음(본인). 가짜 알림은 서버 확인에서 걸러짐
--
-- 한계: 익명 로그인이라 브라우저 데이터를 지우면 새 id 로 다시 들어올 수 있습니다.
-- 다시 실행해도 안전합니다.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- 1) 표 (API 로 직접 읽거나 쓸 수 없음: RLS 켜고 정책 없음, 아래 함수로만 사용)
create table if not exists public.admins (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
create table if not exists public.banned_users (
  user_id   uuid primary key,
  banned_by uuid,
  reason    text check (reason is null or char_length(reason) <= 200),
  banned_at timestamptz not null default now()
);
create table if not exists public.admin_secret (
  id        int primary key default 1 check (id = 1),
  code_hash text not null
);

alter table public.admins enable row level security;
alter table public.banned_users enable row level security;
alter table public.admin_secret enable row level security;
revoke all on public.admins, public.banned_users, public.admin_secret from anon, authenticated;

-- 2) 관리자 등록: 비밀번호가 맞으면 지금 사용자를 관리자로
create or replace function public.claim_admin(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  if auth.uid() is null or p_code is null or char_length(p_code) < 8 or char_length(p_code) > 128 then
    return false;
  end if;
  select code_hash into v_hash from public.admin_secret where id = 1;
  if v_hash is null or extensions.crypt(p_code, v_hash) <> v_hash then
    perform pg_sleep(1); -- 무작위 대입 속도 늦추기
    return false;
  end if;
  insert into public.admins (user_id) values (auth.uid()) on conflict do nothing;
  return true;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- 3) 내보내기 / 되돌리기 (관리자만)
create or replace function public.ban_user(p_target uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'not admin' using errcode = '42501';
  end if;
  if p_target is null or p_target = auth.uid() or exists (select 1 from public.admins where user_id = p_target) then
    raise exception 'cannot ban this user' using errcode = '22023';
  end if;
  insert into public.banned_users (user_id, banned_by, reason)
  values (p_target, auth.uid(), left(p_reason, 200))
  on conflict (user_id) do nothing;
  -- 방 자리를 지움 → Realtime 권한 정책(방 세션이 있어야 함)도 다음 입장부터 막힘
  delete from public.visitor_sessions where user_id = p_target;
end;
$$;

create or replace function public.unban_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'not admin' using errcode = '42501';
  end if;
  delete from public.banned_users where user_id = p_target;
end;
$$;

-- 4) 확인용: 앱이 '내보내기' 알림이 진짜인지 서버에 물어봄
create or replace function public.is_banned(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.banned_users where user_id = p_target);
$$;

create or replace function public.am_i_banned()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.banned_users where user_id = auth.uid());
$$;

-- 5) 입장: 차단된 사람은 거절 (정원 계산은 20261030000000 과 같음)
create or replace function public.join_room(p_room_id text, p_nickname text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_max int;
  v_count int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.banned_users where user_id = v_uid) then
    raise exception 'banned' using errcode = 'P0003';
  end if;

  select max_players into v_max
    from public.rooms
   where id = p_room_id and is_active
   for update;
  if v_max is null then
    raise exception 'room not found' using errcode = 'P0002';
  end if;

  select count(*) into v_count
    from public.visitor_sessions
   where room_id = p_room_id
     and user_id <> v_uid
     and last_seen_at > now() - interval '90 seconds';
  if v_count >= v_max then
    raise exception 'room is full' using errcode = 'P0001';
  end if;

  insert into public.visitor_sessions (user_id, room_id, nickname, joined_at, last_seen_at)
  values (v_uid, p_room_id, p_nickname, now(), now())
  on conflict (user_id) do update
    set room_id = excluded.room_id,
        nickname = excluded.nickname,
        last_seen_at = now();
end;
$$;

-- 차단된 사람은 하트비트로 세션을 되살리지 못하게
create or replace function public.touch_session()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.visitor_sessions
     set last_seen_at = now()
   where user_id = auth.uid()
     and not exists (select 1 from public.banned_users where user_id = auth.uid());
$$;

revoke all on function public.claim_admin(text), public.is_admin(), public.ban_user(uuid, text), public.unban_user(uuid),
  public.is_banned(uuid), public.am_i_banned(), public.join_room(text, text), public.touch_session() from public, anon;
grant execute on function public.claim_admin(text), public.is_admin(), public.ban_user(uuid, text), public.unban_user(uuid),
  public.is_banned(uuid), public.am_i_banned(), public.join_room(text, text), public.touch_session() to authenticated;

-- =====================================================================
-- 비밀번호 정하기 (위 내용을 실행한 뒤, 따로 한 번 실행. 8자 이상, 이 파일에 적어 두지 마세요)
--
--   insert into public.admin_secret (id, code_hash)
--   values (1, extensions.crypt('여기에-관리자-비밀번호', extensions.gen_salt('bf')))
--   on conflict (id) do update set code_hash = excluded.code_hash;
--
-- 차단 풀기 (대시보드 SQL Editor):
--   delete from public.banned_users where user_id = '<사용자 id>';
-- 관리자 목록·해제:
--   select * from public.admins;   delete from public.admins where user_id = '<사용자 id>';
-- =====================================================================
