// 가까이 있는 상호작용 대상을 찾습니다 (묵주, 소원 초, 성경, 장의자 좌석).
import { AMBO, CANDLE_RACK, ROSARY_STAND, SEATS, type Seat } from "./chapelLayout.ts";
import { FEATURES } from "../features.ts";

export type InteractionTarget =
  | { kind: "rosary" }
  | { kind: "candles" }
  | { kind: "bible" }
  | { kind: "seat"; seat: Seat };

export const INTERACT_RADIUS = 2.2;
export const SEAT_RADIUS = 1.4;

export function findSeat(x: number, z: number, occupied: ReadonlySet<string>): Seat | null {
  let best: Seat | null = null;
  let bestD = SEAT_RADIUS;
  for (const s of SEATS) {
    if (occupied.has(s.id)) continue;
    // 좌석 앞뒤 통로 어느 쪽에서든 앉을 수 있게 좌석/일어설 위치 중 가까운 곳으로 계산
    const d = Math.min(Math.hypot(s.x - x, s.z - z), Math.hypot(s.standX - x, s.standZ - z), Math.hypot(s.x - x, s.z - 0.8 - z));
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/** 초 제단 앞(신자석 쪽)에 서 있으면 소원 초 */
export function nearCandleRack(x: number, z: number): boolean {
  const front = CANDLE_RACK.x + CANDLE_RACK.depth / 2;
  return x > front - 0.1 && x < front + 1.6 && Math.abs(z - CANDLE_RACK.z) < CANDLE_RACK.width / 2 + 0.4;
}

export function findInteraction(x: number, z: number, occupied: ReadonlySet<string>): InteractionTarget | null {
  // 묵주 받침대와 초 제단이 가까이 있으므로 더 가까운 쪽
  const dRosary = Math.hypot(ROSARY_STAND.x - x, ROSARY_STAND.z - z);
  const dCandles = nearCandleRack(x, z) ? Math.abs(z - CANDLE_RACK.z) * 0.5 + (x - CANDLE_RACK.x) * 0.5 : Infinity;
  if (dCandles < dRosary && dCandles < Infinity) return { kind: "candles" };
  if (dRosary < INTERACT_RADIUS) return { kind: "rosary" };
  if (FEATURES.bible && Math.hypot(AMBO.x - x, AMBO.z - z) < INTERACT_RADIUS) return { kind: "bible" };
  const seat = findSeat(x, z, occupied);
  return seat ? { kind: "seat", seat } : null;
}
