-- =====================================================================
-- Silent Chapel 초기 스키마 (개발용 Supabase 프로젝트 전용)
-- ⚠ 운영(Production) 프로젝트에서 실행하지 마세요.
--
-- 설계 원칙
--   * 실시간 위치는 DB에 저장하지 않습니다 (Realtime Broadcast/Presence로만 전달).
--   * 기도 진행 상태도 저장하지 않습니다 (브라우저 localStorage).
--   * DB에는 '방'과 '방에 들어온 방문자 세션'만 둡니다 → Realtime 권한 검사에 사용.
--
-- 학습 포인트
--   Table / Row / Column, Primary Key, Foreign Key, 1:N 관계, Index, RLS, Transaction(함수)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) rooms : 성당 방 목록  (Table)
--    한 행(Row) = 방 하나, 각 열(Column) = 방의 속성
-- ---------------------------------------------------------------------
create table if not exists public.rooms (
  id          text primary key                                  -- Primary Key: 방을 유일하게 식별 (예: 'main-chapel')
              check (id ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
  name        text not null check (char_length(name) between 1 and 60),
  max_players int  not null default 10 check (max_players between 1 and 50),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.rooms is '성당 방. 지금은 main-chapel 하나지만 행을 추가하면 방이 늘어납니다.';

insert into public.rooms (id, name, max_players)
values ('main-chapel', 'Silent Chapel', 10)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2) visitor_sessions : 방에 들어온 임시 방문자  (Table)
--    rooms 1 : N visitor_sessions  (한 방에 여러 방문자)
-- ---------------------------------------------------------------------
create table if not exists public.visitor_sessions (
  user_id      uuid primary key                                 -- Primary Key = 익명 인증 사용자 id
               references auth.users (id) on delete cascade,    -- Foreign Key → auth.users
  room_id      text not null
               references public.rooms (id) on delete cascade,  -- Foreign Key → rooms (1:N 관계)
  nickname     text not null
               check (char_length(nickname) between 1 and 16
                      and nickname = btrim(nickname)
                      and nickname !~ '[<>"&[:cntrl:]]'),      -- 제어문자·HTML 특수문자 금지 (한글 허용)
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

comment on table public.visitor_sessions is
  '현재/최근 방문자. 위치는 저장하지 않으며 입장할 때만 갱신됩니다(매 프레임 저장 금지).';

-- Index: "이 방에 누가 있나"를 빠르게 찾기 위함 (room_id로 자주 검색)
create index if not exists visitor_sessions_room_id_idx on public.visitor_sessions (room_id);
-- Index: 오래된 세션 정리용
create index if not exists visitor_sessions_last_seen_idx on public.visitor_sessions (last_seen_at);

-- ---------------------------------------------------------------------
-- 3) RLS (Row Level Security): 행 단위 접근 권한
-- ---------------------------------------------------------------------
alter table public.rooms enable row level security;
alter table public.visitor_sessions enable row level security;

-- 방 목록은 로그인(익명 포함)한 사용자 누구나 읽기 가능, 쓰기는 불가(대시보드/관리자만)
drop policy if exists "rooms are readable" on public.rooms;
create policy "rooms are readable"
  on public.rooms for select
  to authenticated
  using (is_active);

-- 방문자는 '자기 행'만 읽기/수정/삭제 가능 (다른 사람 세션 정보는 볼 수 없음)
drop policy if exists "read own session" on public.visitor_sessions;
create policy "read own session"
  on public.visitor_sessions for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "delete own session" on public.visitor_sessions;
create policy "delete own session"
  on public.visitor_sessions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- INSERT/UPDATE 는 아래 join_room 함수로만 하도록 직접 쓰기 정책은 만들지 않습니다.

-- ---------------------------------------------------------------------
-- 4) join_room : 방 입장 (Transaction)
--    함수 하나는 하나의 트랜잭션으로 실행됩니다. 검증 → 정원 확인 → upsert 가
--    중간에 실패하면 전부 취소(rollback)되어 데이터가 어중간하게 남지 않습니다.
-- ---------------------------------------------------------------------
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

  -- 최근 2분 안에 활동한 다른 방문자 수 (정원 안내용 소프트 제한)
  select count(*) into v_count
    from public.visitor_sessions
   where room_id = p_room_id
     and user_id <> v_uid
     and last_seen_at > now() - interval '2 minutes';
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

-- ---------------------------------------------------------------------
-- 5) Realtime Authorization (Private 채널 권한)
--    topic 'room:<rooms.id>' 채널에는 join_room 으로 그 방에 들어온 사용자만
--    Broadcast/Presence 를 보내고 받을 수 있습니다.
--    (정책은 채널에 '입장할 때' 검사되고 연결 동안 캐시됩니다 — 메시지마다 검사하지 않음)
-- ---------------------------------------------------------------------
drop policy if exists "room members can receive" on realtime.messages;
create policy "room members can receive"
  on realtime.messages for select
  to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and exists (
      select 1
        from public.visitor_sessions vs
        join public.rooms r on r.id = vs.room_id
       where vs.user_id = (select auth.uid())
         and r.is_active
         and 'room:' || vs.room_id = (select realtime.topic())
    )
  );

drop policy if exists "room members can send" on realtime.messages;
create policy "room members can send"
  on realtime.messages for insert
  to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and exists (
      select 1
        from public.visitor_sessions vs
        join public.rooms r on r.id = vs.room_id
       where vs.user_id = (select auth.uid())
         and r.is_active
         and 'room:' || vs.room_id = (select realtime.topic())
    )
  );

-- ---------------------------------------------------------------------
-- 6) (선택) 오래된 세션 정리 — 필요할 때 SQL Editor에서 수동 실행하거나 pg_cron으로 예약
-- ---------------------------------------------------------------------
-- delete from public.visitor_sessions where last_seen_at < now() - interval '1 day';
