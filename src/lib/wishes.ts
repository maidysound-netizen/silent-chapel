// 소원 초: 색깔, 소원 글 검사, 초 제단 위 자리.
import { CANDLE_RACKS } from "./game/chapelLayout.ts";

export interface WishCandle {
  id: number;
  userId: string;
  nickname: string;
  wish: string;
  /** WISH_COLORS 의 번호 */
  color: number;
  /** 켠 시각 (ms) */
  createdAt: number;
}

export const WISH_MAX = 60;
/** 초는 하루 동안 보임 */
export const WISH_TTL_MS = 24 * 60 * 60 * 1000;

/** 초(유리 촛잔) 색깔 12가지 — 무작위로 하나 */
export const WISH_COLORS = [
  "#c8323c", // 빨강
  "#e07a2e", // 주황
  "#e6c23a", // 노랑
  "#5aa457", // 초록
  "#3f8f8a", // 청록
  "#3d6fc4", // 파랑
  "#2c3f8f", // 남색
  "#7a4bb3", // 보라
  "#d0679b", // 분홍
  "#f2efe6", // 흰색
  "#c9a44a", // 금색
  "#8a5a3c", // 갈색
] as const;

export function randomWishColor(rand = Math.random): number {
  return Math.floor(rand() * WISH_COLORS.length) % WISH_COLORS.length;
}

/** 줄바꿈·제어 문자를 지우고 앞뒤 공백 정리, 60자로 자름 */
export function sanitizeWish(raw: string): string {
  return (
    Array.from(raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim())
      .slice(0, WISH_MAX)
      .join("")
  );
}

export function isValidWish(w: string): boolean {
  return w.length > 0 && Array.from(w).length <= WISH_MAX && w === sanitizeWish(w);
}

/** 하루 안에 켠 초만 (새 것부터) */
export function activeWishes(list: readonly WishCandle[], now = Date.now()): WishCandle[] {
  return list.filter((c) => now - c.createdAt < WISH_TTL_MS).sort((a, b) => b.createdAt - a.createdAt);
}

/** 제단 하나에 놓이는 초 개수 (3단 × 16) */
export const SLOTS_PER_RACK = CANDLE_RACKS[0].tiers * CANDLE_RACKS[0].perTier;
/** 모든 제단을 합친 자리 수 */
export const WISH_SLOTS = SLOTS_PER_RACK * CANDLE_RACKS.length;

/** 단 높이·깊이: 앞(신자석 쪽)이 낮고 벽 쪽이 높음 */
export function tierTop(tier: number): number {
  return 0.8 + tier * 0.16;
}
export function tierX(tier: number, rack = 0): number {
  const r = CANDLE_RACKS[rack];
  const step = r.depth / r.tiers;
  return r.x + r.facing * (r.depth / 2 - step * (tier + 0.5));
}

/**
 * i 번째 초 자리 (0 = 가장 최근). 첫째 제단(성모님 옆)부터, 앞단 가운데부터 채워서 새 초가 잘 보이게 합니다.
 */
export function candleSlot(i: number): { x: number; y: number; z: number; rack: number } {
  const rack = Math.floor(i / SLOTS_PER_RACK) % CANDLE_RACKS.length;
  const r = CANDLE_RACKS[rack];
  const j = i % SLOTS_PER_RACK;
  const tier = Math.floor(j / r.perTier) % r.tiers;
  const k = j % r.perTier;
  // 가운데에서 바깥으로: 0, +1, -1, +2, -2 …
  const order = k === 0 ? 0 : k % 2 === 1 ? (k + 1) / 2 : -k / 2;
  const spacing = (r.width - 0.16) / r.perTier;
  return { x: tierX(tier, rack), y: tierTop(tier), z: r.z + order * spacing - spacing / 2, rack };
}

/** 화면에 보여 줄 소원 초 목록 (서버에서 받아 온 것) */
export class WishStore {
  private list: WishCandle[] = [];
  private listeners = new Set<() => void>();
  version = 0;

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  all(now = Date.now()): WishCandle[] {
    return activeWishes(this.list, now);
  }
  set(list: WishCandle[]) {
    this.list = list;
    this.changed();
  }
  add(c: WishCandle) {
    this.list = [c, ...this.list.filter((x) => x.id !== c.id)];
    this.changed();
  }
  remove(id: number) {
    this.list = this.list.filter((x) => x.id !== id);
    this.changed();
  }
  private changed() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
}

export type LightResult = { ok: true } | { ok: false; reason: "tooSoon" | "daily" | "notInRoom" | "banned" | "invalid" | "notReady" | "error" };

/** 서버 오류 코드 → 안내 종류 (supabase/migrations/20261030030000_wish_candles.sql) */
export function lightErrorReason(e: { code?: string; message?: string }): Exclude<LightResult, { ok: true }>["reason"] {
  switch (e.code) {
    case "P0004":
      return "tooSoon";
    case "P0005":
      return "daily";
    case "P0006":
      return "notInRoom";
    case "P0003":
      return "banned";
    case "22023":
      return "invalid";
    // 서버에 소원 초 함수·표가 아직 없음 (SQL 미실행)
    case "PGRST202":
    case "PGRST205":
    case "42883":
      return "notReady";
    default:
      return "error";
  }
}
