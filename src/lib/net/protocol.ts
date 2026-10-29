// 네트워크 메시지 형식과 검증 (순수 함수).
// 받은 메시지는 '믿지 않는다'가 원칙입니다. 형식·범위·순서를 모두 확인한 뒤에만 사용합니다.

import type { PlayerState, Pose } from "../game/PlayerState.ts";
import { isInsideChapel, SEAT_BY_ID } from "../game/chapelLayout.ts";

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
  return { v: PROTOCOL_VERSION, u: m.u, s: m.s, t: m.t, p: [x, y, z], r: m.r, m: m.m, a: m.a, c };
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

// ---- 제스처 (절) ----

export type Gesture = "bow";
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
  if (m.v !== PROTOCOL_VERSION || !isUserId(m.u) || m.g !== "bow") return null;
  if (!finite(m.t) || m.t > now + MAX_FUTURE_MS || m.t < now - MAX_AGE_MS) return null;
  return { v: PROTOCOL_VERSION, u: m.u, t: m.t, g: "bow" };
}
