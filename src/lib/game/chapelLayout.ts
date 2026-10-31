// 성당 배치 데이터(단위: m). 3D 렌더링과 충돌·상호작용 계산이 같은 데이터를 공유합니다.
// 좌표계: +Y 위, 입구는 +Z(z=16), 제단은 -Z. yaw=0 이면 제단(-Z)을 바라봅니다.

export interface Box2 {
  /** 중심 x, z 와 절반 크기 */
  x: number;
  z: number;
  hx: number;
  hz: number;
  /** 물체 윗면 높이 (m). 카메라가 이보다 높으면 위로 지나갈 수 있음. 없으면 천장까지 */
  top?: number;
}
export interface Circle2 {
  x: number;
  z: number;
  r: number;
}

export interface Seat {
  id: string;
  x: number;
  z: number;
  yaw: number;
  /** 일어날 때 돌아갈 위치 (장의자 사이 통로) */
  standX: number;
  standZ: number;
}

export interface Pew {
  id: string;
  x: number;
  z: number;
  width: number;
  seats: Seat[];
}

export const BOUNDS = { minX: -9.1, maxX: 9.1, minZ: -21.4, maxZ: 15.4 };
export const WALL_X = 9.6;
export const FRONT_Z = 16;
export const APSE_Z = -22;
export const CEILING_Y = 15;
export const SANCTUARY_Z = -12; // 이보다 -Z 쪽은 제단 영역(단 위)
export const SANCTUARY_Y = 0.45;

export const COLUMN_X = 6;
export const COLUMN_ZS = [-15, -10, -5, 0, 5, 10];

export const PEW_ROWS = 9;
export const PEW_WIDTH = 3.6;
export const PEW_DEPTH = 0.7;
export const PEW_FIRST_Z = -8;
export const PEW_SPACING = 1.6;
export const PEW_BLOCK_X = 2.95;
export const SEATS_PER_PEW = 4;

function buildPews(): Pew[] {
  const pews: Pew[] = [];
  for (const side of [-1, 1] as const) {
    for (let row = 0; row < PEW_ROWS; row++) {
      const x = side * PEW_BLOCK_X;
      const z = PEW_FIRST_Z + row * PEW_SPACING;
      const id = `${side < 0 ? "L" : "R"}${row + 1}`;
      const seats: Seat[] = [];
      for (let s = 0; s < SEATS_PER_PEW; s++) {
        const offset = (s - (SEATS_PER_PEW - 1) / 2) * (PEW_WIDTH / SEATS_PER_PEW);
        seats.push({
          id: `${id}-${s + 1}`,
          x: x + offset,
          z: z - 0.02,
          yaw: 0,
          standX: x + offset,
          standZ: z + PEW_SPACING / 2,
        });
      }
      pews.push({ id, x, z, width: PEW_WIDTH, seats });
    }
  }
  return pews;
}

export const PEWS: Pew[] = buildPews();
export const SEATS: Seat[] = PEWS.flatMap((p) => p.seats);
export const SEAT_BY_ID = new Map(SEATS.map((s) => [s.id, s]));

export const ALTAR = { x: 0, z: -16.5, width: 3.2, depth: 1.2, height: 1.05 };
/**
 * 제단 뒤 바닥(제단 단 위)에 받침째 서 있는 십자가상 (Meshy GLB).
 * y = 받침 밑면 높이, height = 받침부터 십자가 꼭대기까지, focusY = 예수님 상 가슴 높이(시선·조명 목표)
 */
export const CRUCIFIX = { x: 0, z: -20.4, y: SANCTUARY_Y, height: 6.4, focusY: SANCTUARY_Y + 4.6 };
export const MARY = { x: -8.7, z: -7.5, yaw: -Math.PI / 2 }; // 오른쪽(+X)을 바라봄
/** 왼쪽 측랑의 성모 기도 공간: 받침대 위 성모상, 벽의 푸른 감실, 바닥 카펫 */
export const MARY_SHRINE = { pedestalH: 0.8, statueH: 2.2, rug: { minX: -9.5, maxX: -6.7, minZ: -9.3, maxZ: -5.0 } };
export const ROSARY_STAND = { x: -7.6, z: -6.3, y: 0.95 };
export const KNEELER = { x: -7.3, z: -7.5 };
/**
 * 성모 기도 공간 옆 초 제단 (소원 초). 3단 계단식, 벽 쪽(-X)으로 갈수록 높아지고 신자석 쪽(+X)을 바라봄.
 * width 는 Z 방향 길이, depth 는 X 방향 깊이
 */
export const CANDLE_RACK = { x: -8.75, z: -5.2, width: 2.4, depth: 0.8, tiers: 3, perTier: 16 };
/**
 * 초 제단 두 곳: 성모 기도 공간 옆(왼쪽 측랑)과, 소원이 많아져 새로 놓은 오른쪽 측랑(장미 제단 옆).
 * facing: 신자석 쪽(정면)이 +X(1)인지 -X(-1)인지. 새 소원부터 첫째 제단을 채우고 둘째로 넘어감
 */
export const CANDLE_RACKS = [
  { ...CANDLE_RACK, facing: 1 },
  { ...CANDLE_RACK, x: 8.75, z: -4.6, facing: -1 },
] as const;
export const AMBO = { x: 4.2, z: -11, y: 1.25 };
/** 오른쪽 측랑의 장미꽃 제단 (성모 기도 공간의 맞은편). 신자석 쪽(-X)을 바라봄 */
export const ROSE_ALTAR = { x: 8.75, z: -7.5, yaw: Math.PI / 2, width: 1.6, depth: 0.6, height: 0.95 };

export const SPAWN = { x: 0, z: 13, yaw: 0 };

export const COLLIDER_BOXES: Box2[] = [
  ...PEWS.map((p) => ({ x: p.x, z: p.z + 0.05, hx: p.width / 2, hz: PEW_DEPTH / 2, top: 1.0 })),
  { x: ALTAR.x, z: ALTAR.z, hx: ALTAR.width / 2 + 0.2, hz: ALTAR.depth / 2 + 0.2, top: SANCTUARY_Y + ALTAR.height + 0.6 },
  // 받침대 위 꽃 선반(1.6m) 까지 막음
  { x: MARY.x, z: MARY.z, hx: 0.8, hz: 0.8, top: MARY_SHRINE.pedestalH + MARY_SHRINE.statueH },
  { x: ROSARY_STAND.x, z: ROSARY_STAND.z, hx: 0.3, hz: 0.3, top: 1.1 },
  { x: KNEELER.x - 0.15, z: KNEELER.z, hx: 0.3, hz: 0.55, top: 0.9 },
  ...CANDLE_RACKS.map((r) => ({ x: r.x, z: r.z, hx: r.depth / 2 + 0.05, hz: r.width / 2 + 0.05, top: 1.4 })),
  { x: AMBO.x, z: AMBO.z, hx: 0.45, hz: 0.4, top: 1.6 },
  { x: ROSE_ALTAR.x, z: ROSE_ALTAR.z, hx: ROSE_ALTAR.depth / 2 + 0.05, hz: ROSE_ALTAR.width / 2 + 0.05, top: ROSE_ALTAR.height + 0.5 },
  // 십자가상 받침(폭 약 1.8m)과 기둥. 팔(높이 4.6m 이상)은 사람·카메라 높이 위라 충돌 상자에서 뺌
  { x: CRUCIFIX.x, z: CRUCIFIX.z - 0.3, hx: 0.95, hz: 0.7, top: CRUCIFIX.y + CRUCIFIX.height },
];

export const COLLIDER_CIRCLES: Circle2[] = COLUMN_ZS.flatMap((z) => [
  { x: -COLUMN_X, z, r: 0.55 },
  { x: COLUMN_X, z, r: 0.55 },
]);

/** 위치에 따른 바닥 높이 (제단 영역 계단을 부드럽게) */
export function floorHeight(z: number): number {
  const top = SANCTUARY_Z - 0.6;
  if (z <= top) return SANCTUARY_Y;
  if (z >= SANCTUARY_Z) return 0;
  return ((SANCTUARY_Z - z) / 0.6) * SANCTUARY_Y;
}

export function isInsideChapel(x: number, z: number, margin = 0.5): boolean {
  return (
    x >= BOUNDS.minX - margin && x <= BOUNDS.maxX + margin && z >= BOUNDS.minZ - margin && z <= BOUNDS.maxZ + margin
  );
}
