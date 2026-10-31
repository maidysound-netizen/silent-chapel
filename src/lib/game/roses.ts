// 꽃: 꽃 제단에서 여러 종류 가운데 한 송이를 받아 성모님·예수님께 바치거나, 바닥에 꽃잎으로 뿌리거나 꽃송이째 놓습니다.
// 바닥의 꽃은 누구나(남이 놓은 것도) 가까이 가서 치울 수 있습니다.
// 꽃은 서버(flower_offerings)에 12시간 동안 남아 모든 방문자에게 보입니다. 서버를 쓸 수 없으면 그때 같은 방에 있던 사람에게만 보입니다.
// 바친 꽃의 자리는 '놓인 순서'로 정해지므로 모든 사람 화면에서 같은 자리에 쌓입니다.
import { ALTAR, MARY, MARY_SHRINE, ROSE_ALTAR, SANCTUARY_Y } from "./chapelLayout.ts";

/** floor: 꽃잎으로 뿌림, floorRose: 꽃송이째 바닥에 놓음 */
export type RoseTarget = "mary" | "jesus" | "floor" | "floorRose";

/** 꽃 모양 (같은 모양은 색만 달리 그림) */
export type FlowerShape = "rose" | "lily" | "tulip" | "daisy";

export interface FlowerKind {
  shape: FlowerShape;
  /** 꽃송이 색 */
  color: string;
  /** 바닥에 뿌린 꽃잎 색 */
  petal: string;
  emoji: string;
}

/** 꽃 종류 (번호가 서버의 flower 값). 이름은 i18n 의 flowerNames 같은 순서 */
export const FLOWERS: readonly FlowerKind[] = [
  { shape: "rose", color: "#a3162a", petal: "#c21f35", emoji: "🌹" },
  { shape: "rose", color: "#f1ece2", petal: "#f6f1e7", emoji: "🤍" },
  { shape: "rose", color: "#e2809f", petal: "#ee9cb5", emoji: "🌸" },
  { shape: "lily", color: "#fbf7ea", petal: "#fbf5e4", emoji: "💮" },
  { shape: "tulip", color: "#f0bd2c", petal: "#f4c948", emoji: "🌷" },
  { shape: "daisy", color: "#ffffff", petal: "#fbfbf4", emoji: "🌼" },
];

export interface RoseItem {
  id: number | string;
  target: RoseTarget;
  /** FLOWERS 번호 */
  flower: number;
  /** 놓인 위치(바닥 높이 포함)와 놓인 방향 */
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** 모양을 조금씩 다르게 하는 값 (모든 사람 화면에서 같음) */
  seed: number;
  createdAt: number;
}

/** 꽃 제단·성모상·제단에서 이 거리 안이면 받기/바치기 가능 */
export const ROSE_PICK_RADIUS = 2.0;
/** 대상별로 보여 주는 최대 개수 (휴대폰 성능) — 넘으면 오래된 것부터 안 보임 */
export const ROSE_CAP: Record<RoseTarget, number> = { mary: 30, jesus: 36, floor: 40, floorRose: 40 };
/** 꽃은 12시간 동안 남음 */
export const FLOWER_TTL_MS = 12 * 60 * 60 * 1000;
/** 이 거리 안의 바닥 꽃(꽃잎·꽃송이)을 치움 */
export const SWEEP_RADIUS = 1.5;

export const isFloorRose = (t: RoseTarget) => t === "floor" || t === "floorRose";
/** 같은 사람이 보낸 꽃 알림은 이 간격보다 자주 받지 않음 (도배 방지) */
export const ROSE_MIN_INTERVAL_MS = 1500;

export function nearRoseAltar(x: number, z: number): boolean {
  return Math.hypot(ROSE_ALTAR.x - x, ROSE_ALTAR.z - z) < ROSE_PICK_RADIUS;
}

export function isFlower(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n < FLOWERS.length;
}

/** 0~1 사이 결정적 난수 (같은 seed → 모든 사람 화면에서 같은 모양) */
export function rand(seed: number, k: number): number {
  const v = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** 성모상 받침대 위 꽃 선반(성모상 발치를 둘러싼 넓은 판)의 반폭 */
export const MARY_SHELF_HALF = 0.8;
/** 바친 꽃(눕힌 꽃) 길이: 줄기 밑동 → 꽃송이 */
export const ROSE_LEN = 0.48;
/** 성모상 발치 반원 고리: 고리별 반지름과 자리 수 */
const MARY_RINGS = [
  { r: 0.44, n: 9 },
  { r: 0.53, n: 10 },
  { r: 0.62, n: 11 },
];
/** 제단 위 앞쪽: 한 층에 놓이는 꽃 수 */
export const JESUS_PER_LAYER = 12;
/** 제단 위 꽃의 맨 아래 높이 (제대포 위) */
export const ALTAR_TOP_Y = SANCTUARY_Y + ALTAR.height + 0.03;

/**
 * n 번째로 바친 꽃의 자리 (0 = 가장 먼저 바친 꽃).
 *  · 성모님: 받침대 위 꽃 선반에서 성모상 발치를 앞쪽(+X) 반원으로 둘러쌈
 *  · 예수님: 제단(책상) 위 앞쪽 가장자리에 한 줄씩, 다음 줄은 조금 뒤·조금 위로 차곡차곡 쌓임.
 *            밑동은 제단 안쪽, 꽃송이는 사람들 쪽(+Z)으로 가장자리에 살짝 걸침
 */
export function offeringSpot(target: "mary" | "jesus", n: number, seed: number): Omit<RoseItem, "id" | "target" | "seed" | "flower" | "createdAt"> {
  const jitter = (k: number, amt: number) => (rand(seed, k) - 0.5) * amt;
  if (target === "mary") {
    let i = n;
    let ring = MARY_RINGS[0];
    for (const rg of MARY_RINGS) {
      ring = rg;
      if (i < rg.n) break;
      i -= rg.n;
    }
    i = i % ring.n;
    // 앞쪽 반원(+X 를 중심으로 ±80°)에 고리를 따라(접선 방향) 눕힘 → 선반 밖으로 삐져나오지 않음
    const a = -1.4 + (i / (ring.n - 1)) * 2.8 + jitter(1, 0.08);
    const r = ring.r + jitter(2, 0.03);
    const tx = -Math.sin(a);
    const tz = Math.cos(a);
    // 꽃의 가운데가 고리 위에 오도록 밑동을 반 길이만큼 뒤로
    return {
      x: MARY.x + Math.cos(a) * r - tx * (ROSE_LEN / 2),
      y: MARY_SHRINE.pedestalH + 0.045,
      z: MARY.z + Math.sin(a) * r - tz * (ROSE_LEN / 2),
      yaw: -(a + Math.PI / 2),
    };
  }
  const layer = Math.floor(n / JESUS_PER_LAYER);
  const col = n % JESUS_PER_LAYER;
  // 층마다 반 칸씩 엇갈려 아래 꽃 사이에 얹힘
  const across = (col - (JESUS_PER_LAYER - 1) / 2) * 0.25 + (layer % 2 ? 0.12 : 0) + jitter(1, 0.04);
  const front = ALTAR.z + ALTAR.depth / 2; // 제단 앞 가장자리
  return {
    x: ALTAR.x + across,
    y: ALTAR_TOP_Y + layer * 0.035,
    z: front - ROSE_LEN + 0.06 - layer * 0.05,
    yaw: -Math.PI / 2 + jitter(3, 0.12), // 꽃송이가 +Z(사람들 쪽)
  };
}

export const PETALS_PER_ROSE = 14;

/** 바닥에 뿌린 꽃잎 위치들 (중심 기준 상대 좌표) */
export function petalOffsets(seed: number, count = PETALS_PER_ROSE): { dx: number; dz: number; rot: number }[] {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = rand(seed, 10 + i) * Math.PI * 2;
    const r = 0.05 + Math.sqrt(rand(seed, 30 + i)) * 0.4;
    out.push({ dx: Math.cos(a) * r, dz: Math.sin(a) * r, rot: rand(seed, 50 + i) * Math.PI * 2 });
  }
  return out;
}

/** 저장되는 꽃 한 송이 (위치는 바닥 꽃만, 바친 꽃은 순서로 자리를 정함) */
export interface FlowerRecord {
  id: number | string;
  target: RoseTarget;
  flower: number;
  seed: number;
  x?: number;
  z?: number;
  /** 바닥 높이 (바닥 꽃) */
  y?: number;
  createdAt: number;
  /** 서버에 아직 없는 꽃: 'local' 내가 놓음(저장 대기) · 'remote' 남이 놓았다는 알림만 받음 */
  pending?: "local" | "remote";
  /** pending 이 생긴 시각 */
  pendingAt?: number;
}

/** 꽃 목록. 서버에서 받은 꽃 + 아직 저장되지 않은 꽃을 합쳐 자리를 계산 */
export class RoseStore {
  private records: FlowerRecord[] = [];
  private nextLocal = 1;
  private listeners = new Set<() => void>();
  private cache: { version: number; now: number; items: RoseItem[] } | null = null;
  version = 0;

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed() {
    this.version++;
    this.cache = null;
    this.listeners.forEach((l) => l());
  }

  /** 보이는 꽃 (12시간 안, 대상별 최대 개수, 자리 계산 포함) */
  all(now = Date.now()): readonly RoseItem[] {
    // 같은 1분 안에서는 다시 계산하지 않음 (12시간 기준이라 충분)
    if (this.cache && this.cache.version === this.version && Math.abs(now - this.cache.now) < 60_000) return this.cache.items;
    const live = this.records.filter((r) => now - r.createdAt < FLOWER_TTL_MS).sort((a, b) => a.createdAt - b.createdAt);
    const out: RoseItem[] = [];
    for (const target of ["mary", "jesus", "floor", "floorRose"] as const) {
      const list = live.filter((r) => r.target === target).slice(-ROSE_CAP[target]);
      list.forEach((r, i) => {
        if (target === "mary" || target === "jesus") {
          out.push({ id: r.id, target, flower: r.flower, seed: r.seed, createdAt: r.createdAt, ...offeringSpot(target, i, r.seed) });
        } else {
          out.push({ id: r.id, target, flower: r.flower, seed: r.seed, createdAt: r.createdAt, x: r.x ?? 0, y: (r.y ?? 0) + 0.012, z: r.z ?? 0, yaw: rand(r.seed, 4) * Math.PI * 2 });
        }
      });
    }
    this.cache = { version: this.version, now, items: out };
    return out;
  }

  /** 꽃 하나 추가 (내가 놓음 = local, 남이 놓았다는 알림 = remote) */
  add(
    target: RoseTarget,
    seed: number,
    floorAt?: { x: number; y: number; z: number },
    flower = 0,
    pending: "local" | "remote" = "local",
    now = Date.now(),
  ): FlowerRecord {
    const rec: FlowerRecord = {
      id: `${pending}-${this.nextLocal++}`,
      target,
      flower: isFlower(flower) ? flower : 0,
      seed,
      createdAt: now,
      pending,
      pendingAt: now,
      ...(isFloorRose(target) && floorAt ? { x: floorAt.x, y: floorAt.y, z: floorAt.z } : {}),
    };
    this.records.push(rec);
    this.changed();
    return rec;
  }

  /** 내가 놓은 꽃이 서버에 저장됨 → 다음에 서버 목록을 받으면 그 줄로 바뀜 */
  confirm(localId: number | string, serverId: number) {
    const r = this.records.find((x) => x.id === localId);
    if (r) r.id = serverId;
    if (r) r.pending = undefined;
  }

  /**
   * 서버에서 받은 12시간 안의 꽃으로 바꿈. requestedAt(요청 시각) 뒤에 생긴, 아직 저장 안 된 꽃은 남겨 둠
   * (방금 놓은 꽃·방금 받은 알림이 깜빡 사라지지 않게)
   */
  replaceFromServer(rows: FlowerRecord[], requestedAt: number) {
    const keep = this.records.filter((r) => r.pending && (r.pending === "local" || (r.pendingAt ?? 0) >= requestedAt - 1500));
    const ids = new Set(rows.map((r) => r.id));
    this.records = [...rows, ...keep.filter((r) => !ids.has(r.id))];
    this.changed();
  }

  /** (x, z) 에서 radius 안의 바닥 꽃잎·꽃송이를 치움. 치운 개수 */
  sweep(x: number, z: number, radius = SWEEP_RADIUS): number {
    const before = this.records.length;
    this.records = this.records.filter((r) => !(isFloorRose(r.target) && Math.hypot((r.x ?? 1e9) - x, (r.z ?? 1e9) - z) <= radius));
    const removed = before - this.records.length;
    if (removed > 0) this.changed();
    return removed;
  }

  /** (x, z) 근처에 치울 바닥 꽃이 있는지 */
  hasFloorNear(x: number, z: number, radius = SWEEP_RADIUS, now = Date.now()): boolean {
    return this.records.some((r) => isFloorRose(r.target) && now - r.createdAt < FLOWER_TTL_MS && Math.hypot((r.x ?? 1e9) - x, (r.z ?? 1e9) - z) <= radius);
  }

  clear() {
    this.records = [];
    this.changed();
  }
}
