// 네트워크 메시지 형식과 검증 (순수 함수).
// 받은 메시지는 '믿지 않는다'가 원칙입니다. 형식·범위·순서를 모두 확인한 뒤에만 사용합니다.

import type { PlayerState, Pose } from "../game/PlayerState.ts";
import { isInsideChapel, SEAT_BY_ID } from "../game/chapelLayout.ts";
import { animCode, animFromCode, deriveAnimState, type AnimState } from "../game/avatarConfig.ts";

export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 256;
/** 보낸 시각이 이보다 미래면(시계 차이 허용 범위 초과) 버립니다 */
export const MAX_FUTURE_MS = 30_000;
/** 이보다 오래된 메시지는 버립니다 */
export const MAX_AGE_MS = 30_000;

/** Broadcast 'st' 이벤트 페이로드. 필드 이름을 짧게 해 메시지 크기를 줄였습니다. */
export interface StateMessage {
  v: number; // 프로토콜 버전
  u: string; // 보낸 사람 user id (Presence key와 같아야 함)
  s: number; // 보낸 사람별 순번 (오래된 메시지 거르기)
  t: number; // 보낸 시각 (ms, epoch)
  p: [number, number, number]; // 위치 (cm 단위 반올림 → m)
  r: number; // yaw (0.01 rad)
  m: 0 | 1; // 이동 중
  a: 0 | 1; // 0 서기, 1 앉기
  c: string | null; // 좌석 id
  /** 애니메이션 상태 코드 (ANIM_STATES 순서: 0 idle, 1 walk, 2 run, 3 sit, 4 kneel, 5 pray).
   *  예전 버전 클라이언트는 보내지 않으므로 선택 항목 — 없으면 m/a 로 추정 */
  k?: number;
}

/**
 * Presence에 올리는 메타데이터. 상태가 바뀔 때만(앉기/일어나기/멈춤) 갱신합니다.
 * p(마지막으로 멈춘 위치)를 넣어 두면 새로 들어온 사람은 Presence 초기 상태만으로
 * 모두의 위치를 알 수 있어, 입장할 때마다 전원이 위치를 다시 방송할 필요가 없습니다.
 */
export interface PresenceMeta {
  n: string; // 닉네임
  a: 0 | 1;
  c: string | null;
  j: number; // 입장 시각
  p?: [number, number, number]; // 마지막으로 멈춘 위치 x, z, yaw
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function encodeState(uid: string, seq: number, s: PlayerState, now = Date.now()): StateMessage {
  return {
    v: PROTOCOL_VERSION,
    u: uid,
    s: seq,
    t: now,
    p: [round2(s.x), round2(s.y), round2(s.z)],
    r: round2(s.yaw),
    m: s.moving ? 1 : 0,
    a: s.pose === "sit" ? 1 : 0,
    c: s.pose === "sit" ? s.seatId : null,
    k: animCode(deriveAnimState(s)),
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEAT_RE = /^[LR]\d{1,2}-\d$/;

export function isUserId(u: unknown): u is string {
  return typeof u === "string" && UUID_RE.test(u);
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** 잘못된 메시지면 null. now 는 받은 시각 */
export function validateState(raw: unknown, now = Date.now()): StateMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (m.v !== PROTOCOL_VERSION) return null;
  if (!isUserId(m.u)) return null;
  if (!finite(m.s) || !Number.isInteger(m.s) || m.s < 0) return null;
  if (!finite(m.t) || m.t > now + MAX_FUTURE_MS || m.t < now - MAX_AGE_MS) return null;
  if (!Array.isArray(m.p) || m.p.length !== 3 || !m.p.every(finite)) return null;
  const [x, y, z] = m.p as number[];
  if (!isInsideChapel(x, z) || y < -1 || y > 3) return null;
  if (!finite(m.r) || Math.abs(m.r) > 7) return null;
  if (m.m !== 0 && m.m !== 1) return null;
  if (m.a !== 0 && m.a !== 1) return null;
  if (m.k !== undefined && animFromCode(m.k) === null) return null;
  let c: string | null = null;
  if (m.a === 1) {
    if (typeof m.c !== "string" || !SEAT_RE.test(m.c) || !SEAT_BY_ID.has(m.c)) return null;
    c = m.c;
  }
  try {
    if (JSON.stringify(raw).length > MAX_MESSAGE_BYTES) return null;
  } catch {
    return null;
  }
  const out: StateMessage = { v: PROTOCOL_VERSION, u: m.u, s: m.s, t: m.t, p: [x, y, z], r: m.r, m: m.m, a: m.a, c };
  if (m.k !== undefined) out.k = m.k as number;
  return out;
}

/** 받은 메시지의 애니메이션 상태. k 가 없거나 자세와 맞지 않으면 m/a 로 추정 */
export function animOf(msg: StateMessage): AnimState {
  const fromPose = deriveAnimState({ pose: poseOf(msg), moving: msg.m === 1 });
  const k = animFromCode(msg.k);
  if (!k) return fromPose;
  // 앉아 있는데 달린다는 식의 모순은 자세 쪽을 믿음
  if (msg.a === 1 && k !== "sit") return "sit";
  if (msg.a === 0 && k === "sit") return fromPose;
  if (msg.m === 0 && (k === "walk" || k === "run")) return "idle";
  return k;
}

export function poseOf(msg: StateMessage): Pose {
  return msg.a === 1 ? "sit" : "stand";
}

// ---- 닉네임 ----

export const NICK_MAX = 16;

/** 제어 문자·태그 문자를 지우고 공백을 정리합니다. 허용: 문자, 숫자, 공백, 일부 기호 */
export function sanitizeNickname(input: string): string {
  return input
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} ._\-~]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NICK_MAX);
}

export function isValidNickname(n: string): boolean {
  return n.length >= 1 && n.length <= NICK_MAX && sanitizeNickname(n) === n;
}

/**
 * 표시용 식별 태그. 서버가 발급한 user id에서 만들어지므로 같은 닉네임이라도 태그가 다릅니다.
 * (닉네임만으로 다른 사람을 사칭하기 어렵게 함)
 */
export function idTag(uid: string): string {
  return uid.replace(/-/g, "").slice(0, 4).toUpperCase();
}

export function validatePresenceMeta(raw: unknown): PresenceMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.n !== "string" || !isValidNickname(m.n)) return null;
  if (m.a !== 0 && m.a !== 1) return null;
  const c = m.a === 1 && typeof m.c === "string" && SEAT_BY_ID.has(m.c) ? m.c : null;
  const j = finite(m.j) ? m.j : 0;
  let p: PresenceMeta["p"];
  if (Array.isArray(m.p) && m.p.length === 3 && m.p.every(finite) && isInsideChapel(m.p[0], m.p[1]) && Math.abs(m.p[2]) <= 7) {
    p = [m.p[0], m.p[1], m.p[2]];
  }
  return { n: m.n, a: m.a, c, j, p };
}

// ---- 전송 빈도 ----

/**
 * 접속자 수에 따라 초당 전송 횟수를 정합니다.
 * n명이 각자 h Hz로 보내면 서버가 처리하는 메시지는 약 n(보내기) + n(n-1)(받기) = n²·h /초.
 * 이를 budget(무료 플랜 초당 100건보다 낮게) 이하로 맞춥니다.
 */
export function sendRateHz(players: number, budgetPerSec = 80, maxHz = 10, minHz = 1): number {
  const n = Math.max(1, players);
  return Math.max(minHz, Math.min(maxHz, budgetPerSec / (n * n)));
}

/** 전송 주기에 맞춘 보간 지연(ms). 패킷 두 개 정도를 버퍼에 둡니다 */
export function interpolationDelayMs(hz: number): number {
  return Math.max(120, Math.min(1500, (1000 / hz) * 1.6));
}

// ---- 제스처 (절 · 성호) ----
// 예전 앱은 "cross" 를 모르는 형식으로 보고 무시하므로 함께 접속해도 문제없음

export type Gesture = "bow" | "cross";
/** Broadcast 'gs' 이벤트: 짧은 동작 신호. 위치와 달리 한 번만 보냅니다 */
export interface GestureMessage {
  v: number;
  u: string;
  t: number;
  g: Gesture;
}

export function validateGesture(raw: unknown, now = Date.now()): GestureMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (m.v !== PROTOCOL_VERSION || !isUserId(m.u) || (m.g !== "bow" && m.g !== "cross")) return null;
  if (!finite(m.t) || m.t > now + MAX_FUTURE_MS || m.t < now - MAX_AGE_MS) return null;
  return { v: PROTOCOL_VERSION, u: m.u, t: m.t, g: m.g };
}

// ---- 관리자 내보내기 알림 ----

/**
 * Broadcast 'md' 이벤트: 관리자가 x 를 내보냈다는 알림.
 * 누구나 이 형식을 흉내 낼 수 있으므로, 받는 쪽은 반드시 서버(is_banned / am_i_banned)에 확인한 뒤에만 따릅니다.
 */
export interface ModerationMessage {
  v: number;
  u: string;
  t: number;
  k: "ban";
  x: string;
}

export function validateModeration(raw: unknown, now = Date.now()): ModerationMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (m.v !== PROTOCOL_VERSION || !isUserId(m.u) || !isUserId(m.x) || m.k !== "ban" || m.u === m.x) return null;
  if (!finite(m.t) || m.t > now + MAX_FUTURE_MS || m.t < now - MAX_AGE_MS) return null;
  return { v: PROTOCOL_VERSION, u: m.u, t: m.t, k: "ban", x: m.x };
}

// ---- 장미꽃 ----

/**
 * Broadcast 'rs' 이벤트: 장미를 받음(pick) / 성모님(mary)·예수님(jesus)께 바침 / 바닥에 뿌림(floor).
 * 꽃 자리는 받는 쪽에서 정하고, 바닥은 p(x, z) 위치에 s(모양 값)로 꽃잎을 흩뿌립니다.
 */
export interface RoseMessage {
  v: number;
  u: string;
  t: number;
  /** floorRose: 꽃송이째 놓음, sweep: p 근처 바닥 꽃 치우기 (장미를 들고 있지 않아도 됨) */
  k: "pick" | "mary" | "jesus" | "floor" | "floorRose" | "sweep";
  s: number;
  p?: [number, number];
  /** 꽃 종류 (FLOWERS 번호). 예전 앱은 보내지 않으므로 없으면 붉은 장미(0) */
  f?: number;
}

const ROSE_KINDS = new Set(["pick", "mary", "jesus", "floor", "floorRose", "sweep"]);

export function validateRose(raw: unknown, now = Date.now()): RoseMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (m.v !== PROTOCOL_VERSION || !isUserId(m.u) || typeof m.k !== "string" || !ROSE_KINDS.has(m.k)) return null;
  if (!finite(m.t) || m.t > now + MAX_FUTURE_MS || m.t < now - MAX_AGE_MS) return null;
  if (!finite(m.s) || !Number.isInteger(m.s) || m.s < 0 || m.s > 1e9) return null;
  const out: RoseMessage = { v: PROTOCOL_VERSION, u: m.u, t: m.t, k: m.k as RoseMessage["k"], s: m.s };
  if (m.f !== undefined) {
    if (typeof m.f !== "number" || !Number.isInteger(m.f) || m.f < 0 || m.f > 7) return null;
    out.f = m.f;
  }
  if (m.k === "floor" || m.k === "floorRose" || m.k === "sweep") {
    if (!Array.isArray(m.p) || m.p.length !== 2 || !m.p.every(finite) || !isInsideChapel(m.p[0], m.p[1])) return null;
    out.p = [m.p[0], m.p[1]];
  }
  return out;
}
