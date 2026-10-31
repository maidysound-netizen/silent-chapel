-- =====================================================================
-- 소원 초를 12시간 동안만 보이게 (찾는 사람이 많아 제단이 빨리 차므로)
-- ⚠ 개발용 Silent Chapel Supabase 프로젝트에서만 실행하세요. 20261030030000_wish_candles.sql 다음에 실행합니다.
--   · 앱도 12시간 지난 초는 화면에서 숨기므로, 이 SQL 은 서버가 보내는 양을 줄이는 정리 작업입니다.
--   · 하루 10개 제한·5분 간격·이틀 지난 초 삭제는 그대로입니다.
-- 다시 실행해도 안전합니다.
-- =====================================================================

drop policy if exists "recent wish candles are readable" on public.wish_candles;
create policy "recent wish candles are readable"
  on public.wish_candles for select
  to authenticated
  using (created_at > now() - interval '12 hours');
