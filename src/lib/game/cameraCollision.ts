// 3인칭 카메라가 기둥·가구·벽을 뚫지 않게 하는 계산 (순수 함수, Three.js 없음).
// 캐릭터 충돌과 같은 배치 데이터(COLLIDER_BOXES / COLLIDER_CIRCLES / BOUNDS)를 높이와 함께 씁니다.
// 머리(target)에서 원하는 카메라 위치(desired)까지 선분을 몇 단계로 나눠 확인하고,
// 처음 막히는 곳 바로 앞까지만 카메라를 보냅니다. 모바일에서도 가볍도록 단순한 샘플링 방식입니다.

import { BOUNDS, CEILING_Y, COLLIDER_BOXES, COLLIDER_CIRCLES } from "./chapelLayout.ts";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 카메라가 물체 표면에서 떨어져 있을 거리 (m) */
export const CAMERA_RADIUS = 0.22;
const STEPS = 32;

function blocked(x: number, y: number, z: number, r: number): boolean {
  if (x < BOUNDS.minX - 0.1 || x > BOUNDS.maxX + 0.1 || z < BOUNDS.minZ || z > BOUNDS.maxZ + 0.3) return true;
  if (y < 0.15 || y > CEILING_Y - 0.5) return true;
  for (const c of COLLIDER_CIRCLES) {
    const dx = x - c.x;
    const dz = z - c.z;
    const rr = c.r + r;
    if (dx * dx + dz * dz < rr * rr) return true;
  }
  for (const b of COLLIDER_BOXES) {
    if (y > (b.top ?? CEILING_Y) + r) continue; // 낮은 물체는 위로 넘어감
    if (Math.abs(x - b.x) < b.hx + r && Math.abs(z - b.z) < b.hz + r) return true;
  }
  return false;
}

/**
 * target → desired 사이에서 카메라가 갈 수 있는 비율 (0..1). 1이면 막힘 없음.
 * 벽에 바짝 붙으면 머리 가까이까지 당겨 오며(minDistance), 그때 내 아바타는 LocalPlayer 가 숨깁니다.
 */
export function cameraFreeFraction(target: Vec3, desired: Vec3, minDistance = 0.12): number {
  const dx = desired.x - target.x;
  const dy = desired.y - target.y;
  const dz = desired.z - target.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return 1;
  const minT = Math.min(1, minDistance / len);
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    if (t < minT) continue;
    if (blocked(target.x + dx * t, target.y + dy * t, target.z + dz * t, CAMERA_RADIUS)) {
      return Math.max(minT, (i - 1) / STEPS);
    }
  }
  return 1;
}
