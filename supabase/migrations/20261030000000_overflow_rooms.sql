-- =====================================================================
-- 방 나누기: 한 방 10명 × 10개 방 = 100명
-- ⚠ 개발용 Silent Chapel Supabase 프로젝트에서만 실행하세요.
--
-- 바뀌는 것
--   1) 방 9개 추가 (chapel-2 … chapel-10). 앱은 앞 방이 가득 차면 다음 방으로 자동 입장합니다.
--   2) 정원 계산 고침: 예전에는 '최근 2분 안에 입장한 사람'만 셌기 때문에 오래 머문 사람이
--      정원에서 빠져 실제로는 10명 제한이 걸리지 않았습니다. 이제 앱이 30초마다 touch_session 으로
--      '아직 있음'을 알리고, 최근 90초 안에 신호가 있는 사람만 셉니다.
--   3) leave_room: 나갈 때 자리를 바로 비웁니다 (실패해도 90초 뒤 자동으로 빠짐).
--
-- 다시 실행해도 안전합니다 (on conflict / create or replace).
-- =====================================================================

-- 1) 방 추가
insert into public.rooms (id, name, max_players)
select 'chapel-' || n, 'Silent Chapel ' || n, 10
  from generate_series(2, 10) as n
on conflict (id) do nothing;

-- 2) 정원 계산: 최근 90초 안에 신호가 있는 사람만
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

  -- 방 행을 잠가(for update) 동시에 여러 명이 들어와도 정원 계산이 꼬이지 않게 함
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

revoke all on function public.join_room(text, text) from public, anon;
grant execute on function public.join_room(text, text) to authenticated;

-- 3) 하트비트: 내 세션의 last_seen_at 만 갱신 (앱이 30초마다 호출)
create or replace function public.touch_session()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.visitor_sessions
     set last_seen_at = now()
   where user_id = auth.uid();
$$;

revoke all on function public.touch_session() from public, anon;
grant execute on function public.touch_session() to authenticated;

-- 4) 나가기: 내 세션 삭제 → 자리가 바로 빔
create or replace function public.leave_room()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.visitor_sessions
   where user_id = auth.uid();
$$;

revoke all on function public.leave_room() from public, anon;
grant execute on function public.leave_room() to authenticated;
