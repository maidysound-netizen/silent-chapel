// 가까이 있는 상호작용 대상을 찾습니다 (묵주, 성경, 장의자 좌석).
import { AMBO, ROSARY_STAND, SEATS, type Seat } from "./chapelLayout.ts";
import { FEATURES } from "../features.ts";

export type InteractionTarget =
  | { kind: "rosary" }
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

export function findInteraction(x: number, z: number, occupied: ReadonlySet<string>): InteractionTarget | null {
  if (Math.hypot(ROSARY_STAND.x - x, ROSARY_STAND.z - z) < INTERACT_RADIUS) return { kind: "rosary" };
  if (FEATURES.bible && Math.hypot(AMBO.x - x, AMBO.z - z) < INTERACT_RADIUS) return { kind: "bible" };
  const seat = findSeat(x, z, occupied);
  return seat ? { kind: "seat", seat } : null;
}
