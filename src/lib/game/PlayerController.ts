// 이동·충돌 계산 (순수 함수). 입력 → 다음 위치.
// 성당 MVP는 클라이언트가 자기 위치를 결정합니다(클라이언트 권위). FPS에서는 같은 함수를
// 서버에서도 실행해 결과를 검증·보정하게 됩니다(docs/FPS_MULTIPLAYER_GUIDE.md 참고).

import type { PlayerState } from "./PlayerState.ts";
import { lerpAngle } from "./PlayerState.ts";
import { MOVE_CONFIG } from "./avatarConfig.ts";
import { BOUNDS, COLLIDER_BOXES, COLLIDER_CIRCLES, floorHeight, type Box2, type Circle2 } from "./chapelLayout.ts";

// 속도·반지름 값은 avatarConfig.ts 의 MOVE_CONFIG 에서 관리합니다
export const WALK_SPEED = MOVE_CONFIG.walkSpeed; // m/s — 성당 안을 천천히 걷는 속도
export const RUN_SPEED = MOVE_CONFIG.runSpeed;
export const PLAYER_RADIUS = MOVE_CONFIG.radius;
export const TURN_RATE = MOVE_CONFIG.turnRate;

export interface MoveInput {
  /** -1..1 (앞 +) */
  forward: number;
  /** -1..1 (오른쪽 +) */
  right: number;
  /** 달리기 (Shift / 달리기 버튼) */
  run?: boolean;
}

/** 원과 축정렬 상자의 충돌을 밀어내기로 해소 */
function resolveBox(p: { x: number; z: number }, b: Box2, r: number) {
  const cx = Math.max(b.x - b.hx, Math.min(p.x, b.x + b.hx));
  const cz = Math.max(b.z - b.hz, Math.min(p.z, b.z + b.hz));
  const dx = p.x - cx;
  const dz = p.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    p.x = cx + (dx / d) * r;
    p.z = cz + (dz / d) * r;
  } else {
    // 중심이 상자 안: 가장 가까운 면으로 밀어냄
    const left = p.x - (b.x - b.hx);
    const right = b.x + b.hx - p.x;
    const back = p.z - (b.z - b.hz);
    const front = b.z + b.hz - p.z;
    const m = Math.min(left, right, back, front);
    if (m === left) p.x = b.x - b.hx - r;
    else if (m === right) p.x = b.x + b.hx + r;
    else if (m === back) p.z = b.z - b.hz - r;
    else p.z = b.z + b.hz + r;
  }
}

function resolveCircle(p: { x: number; z: number }, c: Circle2, r: number) {
  const dx = p.x - c.x;
  const dz = p.z - c.z;
  const min = c.r + r;
  const d2 = dx * dx + dz * dz;
  if (d2 >= min * min) return;
  const d = Math.sqrt(d2) || 1e-4;
  p.x = c.x + (dx / d) * min;
  p.z = c.z + (dz / d) * min;
}

export function collide(x: number, z: number, r = PLAYER_RADIUS): { x: number; z: number } {
  const p = { x, z };
  for (let iter = 0; iter < 2; iter++) {
    for (const b of COLLIDER_BOXES) resolveBox(p, b, r);
    for (const c of COLLIDER_CIRCLES) resolveCircle(p, c, r);
  }
  p.x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, p.x));
  p.z = Math.max(BOUNDS.minZ, Math.min(BOUNDS.maxZ, p.z));
  return p;
}

/**
 * 한 프레임 이동을 계산합니다. cameraYaw 기준으로 입력을 월드 방향으로 바꿉니다.
 * 앉아 있으면 움직이지 않습니다.
 */
export function stepPlayer(s: PlayerState, input: MoveInput, cameraYaw: number, dt: number): PlayerState {
  if (s.pose === "sit") return { ...s, moving: false, running: false };
  let f = input.forward;
  let r = input.right;
  const len = Math.hypot(f, r);
  if (len > 1) {
    f /= len;
    r /= len;
  }
  if (len < 0.05) return { ...s, moving: false, running: false, y: floorHeight(s.z) };
  const running = !!input.run;
  const speed = running ? RUN_SPEED : WALK_SPEED;

  // yaw=0 → 정면 (0,0,-1), 오른쪽 (1,0,0)
  const sin = Math.sin(cameraYaw);
  const cos = Math.cos(cameraYaw);
  const dx = (-sin * f + cos * r) * speed * dt;
  const dz = (-cos * f - sin * r) * speed * dt;
  const next = collide(s.x + dx, s.z + dz);
  const targetYaw = Math.atan2(-dx, -dz);
  return {
    ...s,
    x: next.x,
    z: next.z,
    y: floorHeight(next.z),
    yaw: lerpAngle(s.yaw, targetYaw, Math.min(1, TURN_RATE * dt)),
    moving: true,
    running,
  };
}
