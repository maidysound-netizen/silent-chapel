// 방(Room) 식별자 규칙. 지금은 기본 성당 하나지만 id만 바꾸면 여러 방으로 확장됩니다.

export const DEFAULT_ROOM_ID = "main-chapel";
const ROOM_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

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
