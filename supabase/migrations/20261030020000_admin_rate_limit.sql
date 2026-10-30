-- =====================================================================
-- 관리자 비밀번호 시도 횟수 제한
-- ⚠ 개발용 Silent Chapel Supabase 프로젝트에서만 실행하세요. 20261030010000_admin_ban.sql 다음에 실행합니다.
--
--   · 한 사람(기기)이 1시간에 3번 틀리면 1시간 동안 그 사람은 더 시도할 수 없음
--   · 익명 계정을 여러 개 만들어 돌려 가며 시도하는 경우를 막기 위해,
--     전체 틀린 횟수가 10분에 30번을 넘으면 10분 동안 모두 잠김
--   · 이미 관리자로 등록된 기기는 영향 없음 (잠김은 새로 관리자가 되는 것만 막음)
--   · 잠겼는지 여부는 알려 주지 않음 (틀렸을 때와 같은 응답) → 공격자가 상태를 알 수 없음
-- 다시 실행해도 안전합니다.
-- =====================================================================

create table if not exists public.admin_claim_failures (
  id           bigint generated always as identity primary key,
  user_id      uuid not null,
  attempted_at timestamptz not null default now()
);
create index if not exists admin_claim_failures_at_idx on public.admin_claim_failures (attempted_at);
create index if not exists admin_claim_failures_user_idx on public.admin_claim_failures (user_id, attempted_at);

alter table public.admin_claim_failures enable row level security;
revoke all on public.admin_claim_failures from anon, authenticated;

create or replace function public.claim_admin(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_mine int;
  v_all int;
begin
  if v_uid is null or p_code is null or char_length(p_code) < 8 or char_length(p_code) > 128 then
    return false;
  end if;

  -- 오래된 기록 정리 (하루 지난 것)
  delete from public.admin_claim_failures where attempted_at < now() - interval '1 day';

  select count(*) into v_mine from public.admin_claim_failures
   where user_id = v_uid and attempted_at > now() - interval '1 hour';
  select count(*) into v_all from public.admin_claim_failures
   where attempted_at > now() - interval '10 minutes';
  if v_mine >= 3 or v_all >= 30 then
    perform pg_sleep(1);
    return false; -- 잠김: 비밀번호를 비교하지도 않음
  end if;

  select code_hash into v_hash from public.admin_secret where id = 1;
  if v_hash is null or extensions.crypt(p_code, v_hash) <> v_hash then
    insert into public.admin_claim_failures (user_id) values (v_uid);
    perform pg_sleep(1);
    return false;
  end if;

  insert into public.admins (user_id) values (v_uid) on conflict do nothing;
  return true;
end;
$$;

revoke all on function public.claim_admin(text) from public, anon;
grant execute on function public.claim_admin(text) to authenticated;

-- 잠김을 바로 풀고 싶을 때 (SQL Editor):
--   delete from public.admin_claim_failures;
-- 최근 실패 기록 보기:
--   select user_id, count(*), max(attempted_at) from public.admin_claim_failures group by user_id order by 2 desc;
