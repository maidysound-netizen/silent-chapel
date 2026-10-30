// 아바타 모델·이동 속도·애니메이션 설정 (순수 데이터 + 상태 계산, Three.js 없음).
// Wands King Bride GLB가 준비되면 AVATAR_MODEL.url 과 clips 이름만 바꾸면 됩니다 (public/models/README.md).

/** 이동 속도 (m/s)와 회전 속도. 모델 크기와는 따로 관리합니다 */
export const MOVE_CONFIG = {
  walkSpeed: 2.3,
  runSpeed: 4.4,
  /** 이동 방향으로 몸을 돌리는 빠르기 (클수록 빨리 돎) */
  turnRate: 10,
  /** 충돌 반지름 (m) */
  radius: 0.3,
} as const;

/**
 * 아바타 애니메이션 상태. 배열 순서가 네트워크 코드(0..)이므로 끝에만 추가하세요.
 * sit 은 지금 쓰이고, kneel · pray 는 앞으로 무릎 꿇기·기도 자세를 넣을 자리입니다.
 */
export const ANIM_STATES = ["idle", "walk", "run", "sit", "kneel", "pray"] as const;
export type AnimState = (typeof ANIM_STATES)[number];

/** 클립이 없을 때 대신 쓸 상태 (예: GLB에 Run이 없으면 Walk) */
export const ANIM_FALLBACK: Record<AnimState, AnimState | null> = {
  idle: null,
  walk: "idle",
  run: "walk",
  sit: "idle",
  kneel: "idle",
  pray: "kneel",
};

export interface AvatarModelConfig {
  /** GLB 경로 (public/ 기준). null 이면 코드로 만든 임시 캐릭터를 씁니다 */
  url: string | null;
  /** 화면에 보일 키 (m). 모델 원래 크기와 상관없이 이 높이로 맞춥니다 */
  heightM: number;
  /** 발이 바닥에 닿도록 올리고 내릴 값 (m) */
  yOffset: number;
  /** 모델 정면을 -Z(이 앱의 앞)로 맞추는 회전 (라디안). glTF 기본 정면은 +Z라서 PI */
  rotationY: number;
  /** 상태별 GLB 애니메이션 클립 이름 (대소문자 무시). 없는 클립은 ANIM_FALLBACK 으로 대신 */
  clips: Partial<Record<AnimState | "bow", string>>;
  /** 애니메이션 전환 크로스페이드 시간 (초) */
  fadeSec: number;
  /** 걷기/달리기 클립이 이 속도(m/s)로 걸을 때 발이 미끄러지지 않음 → 실제 속도에 맞춰 재생 속도 조절 */
  clipSpeed: { walk: number; run: number };
}

export const AVATAR_MODEL: AvatarModelConfig = {
  url: null, // 예: "/models/wands-king-bride.glb"
  heightM: 1.65,
  yOffset: 0,
  rotationY: Math.PI,
  clips: { idle: "Idle", walk: "Walk", run: "Run", sit: "Sit", kneel: "Kneel", pray: "Pray", bow: "Bow" },
  fadeSec: 0.3,
  clipSpeed: { walk: MOVE_CONFIG.walkSpeed, run: MOVE_CONFIG.runSpeed },
};

/** 이동·자세 상태에서 애니메이션 상태를 정합니다 (로컬·원격 공통) */
export function deriveAnimState(s: { pose: string; moving: boolean; running?: boolean }): AnimState {
  if (s.pose === "sit") return "sit";
  if (s.pose === "kneel") return "kneel";
  if (s.pose === "pray") return "pray";
  if (!s.moving) return "idle";
  return s.running ? "run" : "walk";
}

/** 쓸 수 있는 클립이 나올 때까지 대체 상태를 따라갑니다. 하나도 없으면 null */
export function resolveAnimState(state: AnimState, has: (s: AnimState) => boolean): AnimState | null {
  let s: AnimState | null = state;
  for (let i = 0; s && i < ANIM_STATES.length; i++) {
    if (has(s)) return s;
    s = ANIM_FALLBACK[s];
  }
  return null;
}

export function animCode(s: AnimState): number {
  return ANIM_STATES.indexOf(s);
}

/** 네트워크로 받은 코드 → 상태. 잘못된 코드면 null */
export function animFromCode(k: unknown): AnimState | null {
  return typeof k === "number" && Number.isInteger(k) && k >= 0 && k < ANIM_STATES.length ? ANIM_STATES[k] : null;
}
