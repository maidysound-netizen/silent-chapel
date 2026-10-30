// 방(Room) 식별자 규칙과 방 나누기(오버플로) 순서.
// 한 방은 10명까지라, 가득 차면 main-chapel → chapel-2 → … → chapel-10 순서로 다음 방에 들어갑니다.
// 10개 방 × 10명 = 100명. 방을 더 늘리려면 ROOM_COUNT 와 DB rooms 행을 함께 늘리세요.

export const DEFAULT_ROOM_ID = "main-chapel";
const ROOM_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** 자동 배정에 쓰는 방 개수 (supabase/migrations 의 rooms 행과 맞춰야 함) */
export const ROOM_COUNT = 10;
export const ROOM_SEQUENCE: readonly string[] = [
  DEFAULT_ROOM_ID,
  ...Array.from({ length: ROOM_COUNT - 1 }, (_, i) => `chapel-${i + 2}`),
];

export function isValidRoomId(id: string): boolean {
  return ROOM_RE.test(id);
}

/** Realtime 채널 topic. DB의 RLS 정책도 같은 규칙('room:' || rooms.id)을 사용합니다 */
export function roomTopic(roomId: string): string {
  if (!isValidRoomId(roomId)) throw new Error(`invalid room id: ${roomId}`);
  return `room:${roomId}`;
}

/** URL ?room=xxx 로 방을 고를 수 있게 함 (검증 실패 시 기본 방) */
export function roomFromLocation(search: string): string {
  try {
    const r = new URLSearchParams(search).get("room");
    return r && isValidRoomId(r) ? r : DEFAULT_ROOM_ID;
  } catch {
    return DEFAULT_ROOM_ID;
  }
}

/**
 * 입장을 시도할 방 순서. 자동 배정 방이면 그 방부터 한 바퀴 돌고,
 * ?room= 으로 고른 별도 방이면 그 방만 시도합니다.
 */
export function roomCandidates(start: string): string[] {
  const i = ROOM_SEQUENCE.indexOf(start);
  if (i < 0) return [start];
  return [...ROOM_SEQUENCE.slice(i), ...ROOM_SEQUENCE.slice(0, i)];
}

/** 화면에 보일 방 번호 (main-chapel = 1). 자동 배정 방이 아니면 null */
export function roomNumber(id: string | null): number | null {
  if (!id) return null;
  const i = ROOM_SEQUENCE.indexOf(id);
  return i < 0 ? null : i + 1;
}
