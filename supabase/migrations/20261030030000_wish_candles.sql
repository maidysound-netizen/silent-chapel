-- =====================================================================
-- 소원 초: 초 제단에 소원을 적은 초를 켜 두면 하루(24시간) 동안 모든 방문자에게 보입니다.
-- ⚠ 개발용 Silent Chapel Supabase 프로젝트에서만 실행하세요. 20261030020000_admin_rate_limit.sql 다음에 실행합니다.
--
--   · 소원은 60자까지, 초 색깔은 앱이 무작위로 고른 번호(0~11)
--   · 한 사람(기기)당 5분에 1개, 하루 10개까지 (도배 방지)
--   · 내보내진(차단된) 사람은 켤 수 없음
--   · 자기 초는 직접 끌 수 있고, 관리자는 어떤 초든 끌 수 있음
--   · 하루가 지난 초는 보이지 않고, 이틀이 지나면 지워짐
-- 다시 실행해도 안전합니다.
-- =====================================================================

create table if not exists public.wish_candles (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  nickname   text not null check (char_length(nickname) between 1 and 16),
  wish       text not null check (char_length(wish) between 1 and 60 and wish !~ '[[:cntrl:]]'),
  color      smallint not null check (color between 0 and 11),
  created_at timestamptz not null default now()
);
create index if not exists wish_candles_created_idx on public.wish_candles (created_at desc);
create index if not exists wish_candles_user_idx on public.wish_candles (user_id, created_at desc);

alter table public.wish_candles enable row level security;
revoke all on public.wish_candles from anon, authenticated;
grant select on public.wish_candles to authenticated;

-- 읽기: 로그인(익명 포함)한 사람은 하루 안의 초만 볼 수 있음. 쓰기·지우기는 아래 함수로만
drop policy if exists "recent wish candles are readable" on public.wish_candles;
create policy "recent wish candles are readable"
  on public.wish_candles for select
  to authenticated
  using (created_at > now() - interval '1 day');

-- 초 켜기
create or replace function public.light_candle(p_wish text, p_color int)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_wish text := btrim(p_wish);
  v_nick text;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.banned_users where user_id = v_uid) then
    raise exception 'banned' using errcode = 'P0003';
  end if;
  if v_wish is null or char_length(v_wish) < 1 or char_length(v_wish) > 60 or v_wish ~ '[[:cntrl:]]' then
    raise exception 'invalid wish' using errcode = '22023';
  end if;
  if p_color is null or p_color < 0 or p_color > 11 then
    raise exception 'invalid color' using errcode = '22023';
  end if;
  if exists (select 1 from public.wish_candles where user_id = v_uid and created_at > now() - interval '5 minutes') then
    raise exception 'too soon' using errcode = 'P0004';
  end if;
  if (select count(*) from public.wish_candles where user_id = v_uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'daily limit' using errcode = 'P0005';
  end if;
  -- 이름은 방에 들어올 때 검증된 닉네임을 씀 (방에 들어와 있어야 켤 수 있음)
  select nickname into v_nick from public.visitor_sessions where user_id = v_uid;
  if v_nick is null then
    raise exception 'not in a room' using errcode = 'P0006';
  end if;

  delete from public.wish_candles where created_at < now() - interval '2 days';
  insert into public.wish_candles (user_id, nickname, wish, color)
  values (v_uid, v_nick, v_wish, p_color)
  returning id into v_id;
  return v_id;
end;
$$;

-- 초 끄기: 자기 초 또는 관리자
create or replace function public.remove_candle(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.wish_candles
   where id = p_id
     and (user_id = auth.uid() or exists (select 1 from public.admins where user_id = auth.uid()));
end;
$$;

revoke all on function public.light_candle(text, int), public.remove_candle(bigint) from public, anon;
grant execute on function public.light_candle(text, int), public.remove_candle(bigint) to authenticated;
