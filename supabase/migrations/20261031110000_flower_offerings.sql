-- =====================================================================
-- 바친 꽃·바닥의 꽃을 12시간 동안 남기기 (모든 방의 모든 방문자에게 보임)
-- ⚠ 개발용 Silent Chapel Supabase 프로젝트에서만 실행하세요. 20261031100000_wish_candles_12h.sql 다음에 실행합니다.
--
--   · target: mary(성모님께) · jesus(예수님께, 제단 위) · floor(꽃잎으로 뿌림) · floorRose(꽃송이째 바닥에)
--   · flower: 꽃 종류 번호 (0 붉은 장미, 1 흰 장미, 2 분홍 장미, 3 백합, 4 튤립, 5 데이지)
--   · 바닥 꽃은 누구나 가까이에서 치울 수 있음 (sweep_flowers, 반지름 1.5m)
--   · 도배 방지: 한 사람당 3초에 1번, 1시간에 60번까지. 방에 들어와 있어야 하고, 내보내진 사람은 불가
--   · 12시간이 지나면 보이지 않고, 하루가 지나면 지워짐
-- SQL 을 실행하기 전에는 예전처럼 '그때 같은 방에 있던 사람에게만' 보입니다.
-- 다시 실행해도 안전합니다.
-- =====================================================================

create table if not exists public.flower_offerings (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  target     text not null check (target in ('mary', 'jesus', 'floor', 'floorRose')),
  flower     smallint not null check (flower between 0 and 7),
  seed       integer not null check (seed between 0 and 1000000000),
  x          real,
  z          real,
  created_at timestamptz not null default now(),
  -- 바닥 꽃만 위치가 있음
  check ((target in ('floor', 'floorRose')) = (x is not null and z is not null))
);
create index if not exists flower_offerings_created_idx on public.flower_offerings (created_at desc);
create index if not exists flower_offerings_user_idx on public.flower_offerings (user_id, created_at desc);

alter table public.flower_offerings enable row level security;
revoke all on public.flower_offerings from anon, authenticated;
grant select (id, target, flower, seed, x, z, created_at) on public.flower_offerings to authenticated;

drop policy if exists "recent flowers are readable" on public.flower_offerings;
create policy "recent flowers are readable"
  on public.flower_offerings for select
  to authenticated
  using (created_at > now() - interval '12 hours');

-- 꽃 놓기 (바치기·뿌리기·꽃송이째 놓기)
create or replace function public.place_flower(p_target text, p_flower int, p_seed int, p_x real default null, p_z real default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_floor boolean := p_target in ('floor', 'floorRose');
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.banned_users where user_id = v_uid) then
    raise exception 'banned' using errcode = 'P0003';
  end if;
  if not exists (select 1 from public.visitor_sessions where user_id = v_uid) then
    raise exception 'not in a room' using errcode = 'P0006';
  end if;
  if p_target is null or p_target not in ('mary', 'jesus', 'floor', 'floorRose')
     or p_flower is null or p_flower < 0 or p_flower > 7
     or p_seed is null or p_seed < 0 or p_seed > 1000000000 then
    raise exception 'invalid flower' using errcode = '22023';
  end if;
  -- 바닥 꽃은 성당 안쪽 좌표만
  if v_floor and (p_x is null or p_z is null or p_x < -10 or p_x > 10 or p_z < -22.5 or p_z > 16.5) then
    raise exception 'invalid position' using errcode = '22023';
  end if;
  if exists (select 1 from public.flower_offerings where user_id = v_uid and created_at > now() - interval '3 seconds') then
    raise exception 'too soon' using errcode = 'P0004';
  end if;
  if (select count(*) from public.flower_offerings where user_id = v_uid and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'hourly limit' using errcode = 'P0005';
  end if;

  delete from public.flower_offerings where created_at < now() - interval '1 day';
  insert into public.flower_offerings (user_id, target, flower, seed, x, z)
  values (v_uid, p_target, p_flower, p_seed, case when v_floor then p_x end, case when v_floor then p_z end)
  returning id into v_id;
  return v_id;
end;
$$;

-- 바닥 꽃 치우기: (p_x, p_z) 에서 1.5m 안의 꽃잎·꽃송이 (남이 놓은 것도)
create or replace function public.sweep_flowers(p_x real, p_z real)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null or not exists (select 1 from public.visitor_sessions where user_id = v_uid)
     or exists (select 1 from public.banned_users where user_id = v_uid) then
    return 0;
  end if;
  delete from public.flower_offerings
   where target in ('floor', 'floorRose')
     and created_at > now() - interval '12 hours'
     and (x - p_x) * (x - p_x) + (z - p_z) * (z - p_z) <= 2.25;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.place_flower(text, int, int, real, real), public.sweep_flowers(real, real) from public, anon;
grant execute on function public.place_flower(text, int, int, real, real), public.sweep_flowers(real, real) to authenticated;

-- 모든 꽃 지우기 (관리용, SQL Editor): delete from public.flower_offerings;
