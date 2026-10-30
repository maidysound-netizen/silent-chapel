// 장미꽃: 장미 제단에서 한 송이를 받아 성모님·예수님께 바치거나 바닥에 뿌립니다.
// 바친 꽃은 지금 같은 방에 있는 사람들 화면에만 보이고(저장하지 않음), 너무 많아지면 오래된 것부터 사라집니다.
import { ALTAR, MARY, MARY_SHRINE, ROSE_ALTAR, SANCTUARY_Y } from "./chapelLayout.ts";

export type RoseTarget = "mary" | "jesus" | "floor";

export interface RoseItem {
  id: number;
  target: RoseTarget;
  /** 놓인 위치(바닥 높이 포함)와 놓인 방향 */
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** 바닥에 뿌린 경우 꽃잎 흩어짐 모양을 정하는 값 */
  seed: number;
}

/** 장미 제단·성모상·제단에서 이 거리 안이면 받기/바치기 가능 */
export const ROSE_PICK_RADIUS = 2.0;
/** 대상별로 남겨 두는 최대 개수 (휴대폰 성능) */
export const ROSE_CAP: Record<RoseTarget, number> = { mary: 30, jesus: 30, floor: 40 };
/** 같은 사람이 보낸 장미 알림은 이 간격보다 자주 받지 않음 (도배 방지) */
export const ROSE_MIN_INTERVAL_MS = 1500;

export function nearRoseAltar(x: number, z: number): boolean {
  return Math.hypot(ROSE_ALTAR.x - x, ROSE_ALTAR.z - z) < ROSE_PICK_RADIUS;
}

/** 0~1 사이 결정적 난수 (같은 seed → 모든 사람 화면에서 같은 모양) */
export function rand(seed: number, k: number): number {
  const v = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** 성모상 받침대 위 꽃 선반(성모상 발치를 둘러싼 넓은 판)의 반폭 */
export const MARY_SHELF_HALF = 0.8;
/** 바친 장미(눕힌 꽃) 길이: 줄기 밑동 → 꽃송이 */
export const ROSE_LEN = 0.48;
/** 성모상 발치 반원 고리: 고리별 반지름과 자리 수 */
const MARY_RINGS = [
  { r: 0.44, n: 9 },
  { r: 0.53, n: 10 },
  { r: 0.62, n: 11 },
];

/**
 * n 번째로 바친 꽃의 자리.
 *  · 성모님: 받침대 위 꽃 선반에서 성모상 발치를 앞쪽(+X) 반원으로 둘러쌈 (무릎틀에 가리지 않는 높이)
 *  · 예수님: 제단 앞(+Z) 단 위 바닥에 줄지어 놓임
 */
export function offeringSpot(target: "mary" | "jesus", n: number, seed: number): Omit<RoseItem, "id" | "target" | "seed"> {
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
  const row = Math.floor(n / 8);
  const col = n % 8;
  const across = (col - 3.5) * 0.2 + jitter(1, 0.06);
  const out = 0.15 + row * 0.16 + jitter(2, 0.05);
  const front = ALTAR.z + ALTAR.depth / 2 + 0.1; // 제대포 앞
  // 밑동은 제단 쪽, 꽃송이는 사람들 쪽(+Z)
  return { x: ALTAR.x + across, y: SANCTUARY_Y + 0.02, z: front + out - 0.1, yaw: -Math.PI / 2 + jitter(3, 0.6) };
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

/** 바친 꽃 목록. 대상별 최대 개수를 넘으면 오래된 것부터 지움 */
export class RoseStore {
  private items: RoseItem[] = [];
  private counts: Record<"mary" | "jesus", number> = { mary: 0, jesus: 0 };
  private nextId = 1;
  private listeners = new Set<() => void>();
  version = 0;

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  all(): readonly RoseItem[] {
    return this.items;
  }

  add(target: RoseTarget, seed: number, floorAt?: { x: number; y: number; z: number }): RoseItem {
    let pos: Omit<RoseItem, "id" | "target" | "seed">;
    if (target === "floor") {
      const p = floorAt ?? { x: 0, y: 0, z: 0 };
      pos = { x: p.x, y: p.y + 0.012, z: p.z, yaw: rand(seed, 4) * Math.PI * 2 };
    } else {
      // 자리 번호는 계속 늘려서, 오래된 꽃이 지워져도 새 꽃이 같은 자리에 겹치지 않게 순환
      pos = offeringSpot(target, this.counts[target]++ % ROSE_CAP[target], seed);
    }
    const item: RoseItem = { id: this.nextId++, target, seed, ...pos };
    this.items.push(item);
    const same = this.items.filter((i) => i.target === target);
    if (same.length > ROSE_CAP[target]) {
      const drop = same[0];
      this.items = this.items.filter((i) => i !== drop);
    }
    this.version++;
    this.listeners.forEach((l) => l());
    return item;
  }

  clear() {
    this.items = [];
    this.counts = { mary: 0, jesus: 0 };
    this.version++;
    this.listeners.forEach((l) => l());
  }
}
