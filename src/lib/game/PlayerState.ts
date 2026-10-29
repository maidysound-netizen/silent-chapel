// 플레이어 상태 모델. 로컬 플레이어와 원격 플레이어가 같은 형태를 사용합니다.
// FPS 게임에서도 그대로 확장할 수 있도록 렌더링과 분리했습니다.

export type Pose = "stand" | "sit";

/** 절(인사) 동작 길이: 숙이기 0.7초 → 머무름 1.3초 → 일어서기 0.8초 */
export const BOW_MS = 2800;

export interface PlayerState {
  x: number;
  y: number;
  z: number;
  /** 라디안. 0 = -Z(제단) 방향 */
  yaw: number;
  moving: boolean;
  pose: Pose;
  seatId: string | null;
}

export function createPlayerState(x: number, z: number, yaw: number): PlayerState {
  return { x, y: 0, z, yaw, moving: false, pose: "stand", seatId: null };
}

/** 각도를 -PI..PI 로 정규화 */
export function wrapAngle(a: number): number {
  let r = (a + Math.PI) % (Math.PI * 2);
  if (r < 0) r += Math.PI * 2;
  return r - Math.PI;
}

/** 가장 짧은 방향으로 각도 보간 */
export function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapAngle(b - a) * t;
}
