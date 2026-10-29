// Presence: '누가 이 방에 있는가'를 관리합니다.
// Presence는 무료 플랜에서 초당 20건으로 제한이 더 빡빡하므로 위치가 아니라
// 닉네임·앉기 상태처럼 드물게 바뀌는 정보만 올리고, 갱신 간격도 제한합니다.

import type { RealtimeChannel } from "@supabase/supabase-js";
import { isUserId, validatePresenceMeta, type PresenceMeta } from "./protocol.ts";

export const PRESENCE_MIN_INTERVAL_MS = 2000;

export interface PresenceMember {
  uid: string;
  meta: PresenceMeta;
}

export class PresenceManager {
  private lastTrack = 0;
  private pendingMeta: PresenceMeta | null = null;
  private trailing: ReturnType<typeof setTimeout> | null = null;
  private current: PresenceMeta | null = null;

  private readonly channel: RealtimeChannel;

  constructor(channel: RealtimeChannel) {
    this.channel = channel;
  }

  /** 현재 Presence 상태를 검증된 멤버 목록으로 */
  members(): Map<string, PresenceMember> {
    const out = new Map<string, PresenceMember>();
    const state = this.channel.presenceState<Record<string, unknown>>();
    for (const [key, metas] of Object.entries(state)) {
      if (!isUserId(key) || !Array.isArray(metas) || metas.length === 0) continue;
      // 같은 사용자가 탭을 여러 개 열면 meta가 여러 개 — 가장 최근 것 사용
      const meta = validatePresenceMeta(metas[metas.length - 1]);
      if (meta) out.set(key, { uid: key, meta });
    }
    return out;
  }

  /** 변경이 있을 때만, 최소 간격을 지켜 track */
  update(meta: PresenceMeta, force = false): void {
    if (!force && this.current && sameMeta(this.current, meta)) return;
    this.pendingMeta = meta;
    const wait = this.lastTrack + PRESENCE_MIN_INTERVAL_MS - Date.now();
    if (force || wait <= 0) {
      this.flush();
    } else if (!this.trailing) {
      this.trailing = setTimeout(() => this.flush(), wait);
    }
  }

  private flush(): void {
    if (this.trailing) clearTimeout(this.trailing);
    this.trailing = null;
    const meta = this.pendingMeta;
    if (!meta) return;
    this.pendingMeta = null;
    this.current = meta;
    this.lastTrack = Date.now();
    void this.channel.track(meta as unknown as Record<string, unknown>);
  }

  dispose(): void {
    if (this.trailing) clearTimeout(this.trailing);
    this.trailing = null;
  }
}

function sameMeta(a: PresenceMeta, b: PresenceMeta): boolean {
  return a.n === b.n && a.a === b.a && a.c === b.c && String(a.p) === String(b.p);
}
