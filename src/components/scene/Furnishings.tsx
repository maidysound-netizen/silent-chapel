"use client";
// 장의자, 제단, 십자가상, 성모상, 촛대 등 성당 내부 기물. 모두 기본 지오메트리로 만든 저폴리곤 모델이며,
// 나중에 고품질 GLTF 모델로 바꿀 때는 각 컴포넌트만 교체하면 됩니다.
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { StatueModel, STATUE_URLS } from "./StatueModel";
import * as THREE from "three";
import {
  ALTAR,
  CANDLE_RACK,
  CRUCIFIX,
  KNEELER,
  MARY,
  MARY_SHRINE,
  PEWS,
  PEW_DEPTH,
  SANCTUARY_Y,
  WALL_X,
} from "@/lib/game/chapelLayout";

const WOOD = "#6b4428";
const WOOD_DARK = "#4a2e1b";
const GOLD = "#c9a44a";
const IVORY = "#e8dcc4";

/** 같은 모양을 여러 번 그리는 장의자는 InstancedMesh로 그리기 호출 수를 줄입니다 */
function PewInstances() {
  const parts = useMemo(
    () => [
      // [크기, 장의자 중심 기준 위치]
      { size: [3.6, 0.08, 0.45] as const, offset: [0, 0.45, -0.05] as const },
      { size: [3.6, 0.45, 0.06] as const, offset: [0, 0.7, 0.2] as const },
      { size: [0.08, 0.95, PEW_DEPTH] as const, offset: [-1.8, 0.475, 0.0] as const },
      { size: [0.08, 0.95, PEW_DEPTH] as const, offset: [1.8, 0.475, 0.0] as const },
      // 무릎틀
      { size: [3.4, 0.08, 0.16] as const, offset: [0, 0.14, -0.55] as const },
    ],
    [],
  );
  return (
    <>
      {parts.map((p, i) => (
        <PewPart key={i} size={p.size} offset={p.offset} color={i >= 2 && i <= 3 ? WOOD_DARK : WOOD} />
      ))}
    </>
  );
}

function PewPart({ size, offset, color }: { size: readonly [number, number, number]; offset: readonly [number, number, number]; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    PEWS.forEach((p, i) => {
      // 무릎틀은 -Z(제단 방향), 등받이는 +Z
      m.makeTranslation(p.x + offset[0], offset[1], p.z + offset[2]);
      ref.current!.setMatrixAt(i, m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [offset]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, PEWS.length]} castShadow receiveShadow>
      <boxGeometry args={size as unknown as [number, number, number]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </instancedMesh>
  );
}

export function Flame({ position, scale = 1, seed = 0 }: { position: [number, number, number]; scale?: number; seed?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * 3 + seed;
    const f = 1 + Math.sin(t) * 0.05 + Math.sin(t * 2.7) * 0.04;
    ref.current.scale.set(scale, scale * f, scale);
  });
  return (
    <mesh ref={ref} position={position}>
      <coneGeometry args={[0.025, 0.09, 8]} />
      <meshBasicMaterial color="#ffd27a" toneMapped={false} />
    </mesh>
  );
}

function Candlestick({ position, height = 0.6 }: { position: [number, number, number]; height?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.09, 0.11, 0.06, 12]} />
        <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.025, 0.03, height, 8]} />
        <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, height + 0.12, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 0.24, 10]} />
        <meshStandardMaterial color="#f4ecd8" roughness={0.6} />
      </mesh>
      <Flame position={[0, height + 0.29, 0]} seed={position[0] * 7} />
    </group>
  );
}

function Altar() {
  const top = SANCTUARY_Y + ALTAR.height;
  return (
    <group position={[ALTAR.x, 0, ALTAR.z]}>
      <mesh position={[0, SANCTUARY_Y + ALTAR.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[ALTAR.width, ALTAR.height, ALTAR.depth]} />
        <meshStandardMaterial color="#e4dccb" roughness={0.5} />
      </mesh>
      {/* 제대포 */}
      <mesh position={[0, top + 0.01, 0]} receiveShadow>
        <boxGeometry args={[ALTAR.width + 0.3, 0.02, ALTAR.depth + 0.1]} />
        <meshStandardMaterial color="#fbf8f0" roughness={0.9} />
      </mesh>
      {/* 앞 드리운 천: 윗면이 덮개 밑면과 같은 높이면 겹쳐 깜빡이므로 살짝 아래로 */}
      <mesh position={[0, top - 0.255, ALTAR.depth / 2 + 0.06]}>
        <boxGeometry args={[ALTAR.width + 0.3, 0.5, 0.02]} />
        <meshStandardMaterial color="#fbf8f0" roughness={0.9} />
      </mesh>
      {/* 제대 앞면 금색 십자 장식 */}
      <mesh position={[0, SANCTUARY_Y + 0.5, ALTAR.depth / 2 + 0.01]}>
        <boxGeometry args={[0.06, 0.4, 0.01]} />
        <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, SANCTUARY_Y + 0.58, ALTAR.depth / 2 + 0.01]}>
        <boxGeometry args={[0.26, 0.06, 0.01]} />
        <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.3} />
      </mesh>
      {[-1.25, -0.75, 0.75, 1.25].map((x) => (
        <Candlestick key={x} position={[x, top + 0.02, -0.25]} height={x === -1.25 || x === 1.25 ? 0.5 : 0.4} />
      ))}
    </group>
  );
}

/** 십자가상 GLB를 불러오는 동안·실패했을 때 보이는 단순한 십자가상 (예전 모형, 벽에 걸린 형태) */
function CrucifixFallback() {
  return (
    <group position={[CRUCIFIX.x, 3.2, CRUCIFIX.z - 0.2]}>
      {/* 십자가 */}
      <mesh position={[0, 2.6, 0]} castShadow>
        <boxGeometry args={[0.32, 6.2, 0.2]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.8} />
      </mesh>
      <mesh position={[0, 4.2, 0]} castShadow>
        <boxGeometry args={[3.0, 0.3, 0.2]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.8} />
      </mesh>
      {/* 명패 */}
      <mesh position={[0, 5.25, 0.12]}>
        <boxGeometry args={[0.5, 0.22, 0.03]} />
        <meshStandardMaterial color="#d9cfb8" roughness={0.8} />
      </mesh>
      {/* 예수님 상 */}
      <group position={[0, 0, 0.18]}>
        <mesh position={[0, 4.65, 0.03]} rotation={[0.25, 0, 0.12]}>
          <sphereGeometry args={[0.17, 16, 12]} />
          <meshStandardMaterial color={IVORY} roughness={0.6} />
        </mesh>
        <mesh position={[0, 3.85, 0]} rotation={[0, 0, 0.04]}>
          <capsuleGeometry args={[0.2, 0.75, 6, 12]} />
          <meshStandardMaterial color={IVORY} roughness={0.6} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.68, 4.2, 0]} rotation={[0, 0, s * 1.38]}>
            <capsuleGeometry args={[0.065, 1.05, 4, 8]} />
            <meshStandardMaterial color={IVORY} roughness={0.6} />
          </mesh>
        ))}
        {/* 허리 천 */}
        <mesh position={[0, 3.35, 0]}>
          <cylinderGeometry args={[0.22, 0.25, 0.3, 12]} />
          <meshStandardMaterial color="#f6f1e4" roughness={0.9} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.07, 2.75, 0]} rotation={[0, 0, -s * 0.05]}>
            <capsuleGeometry args={[0.075, 0.9, 4, 8]} />
            <meshStandardMaterial color={IVORY} roughness={0.6} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** 십자가상: 받침이 바닥(제단 단)에 닿아 위로 솟은 Meshy 모델 */
function Crucifix() {
  return (
    <StatueModel
      url={STATUE_URLS.crucifix}
      position={[CRUCIFIX.x, CRUCIFIX.y, CRUCIFIX.z]}
      height={CRUCIFIX.height}
      fallback={<CrucifixFallback />}
    />
  );
}

/** 성모 마리아상 GLB를 불러오는 동안·실패했을 때 보이는 단순한 조각상 (예전 모형) */
function MaryFallback() {
  const robe = useMemo(() => {
    const pts = [
      [0.0, 0],
      [0.42, 0],
      [0.4, 0.2],
      [0.33, 0.8],
      [0.26, 1.25],
      [0.22, 1.42],
      [0.13, 1.55],
      [0.0, 1.56],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 24);
  }, []);
  const mantle = useMemo(() => {
    const pts = [
      [0.47, 0.05],
      [0.43, 0.45],
      [0.36, 1.0],
      [0.27, 1.42],
      [0.2, 1.62],
      [0.12, 1.78],
      [0.0, 1.82],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    // 앞이 트인 망토
    return new THREE.LatheGeometry(pts, 24, Math.PI * 1.25, Math.PI * 1.5);
  }, []);
  return (
    <group position={[MARY.x, 0, MARY.z]} rotation={[0, MARY.yaw, 0]}>
      {/* 받침대 */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 1.0, 0.9]} />
        <meshStandardMaterial color="#cbbfa8" roughness={0.8} />
      </mesh>
      <group position={[0, 1.0, 0]}>
        <mesh geometry={robe} castShadow>
          <meshStandardMaterial color="#f4f1ea" roughness={0.6} />
        </mesh>
        <mesh geometry={mantle} castShadow>
          <meshStandardMaterial color="#5277b8" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.66, 0.02]}>
          <sphereGeometry args={[0.13, 16, 12]} />
          <meshStandardMaterial color={IVORY} roughness={0.6} />
        </mesh>
        {/* 모은 두 손 */}
        <mesh position={[0, 1.2, -0.27]} rotation={[0.5, 0, 0]}>
          <capsuleGeometry args={[0.045, 0.12, 4, 8]} />
          <meshStandardMaterial color={IVORY} roughness={0.6} />
        </mesh>
        {/* 머리 뒤 별 화관 */}
        <mesh position={[0, 1.72, 0.12]}>
          <torusGeometry args={[0.24, 0.012, 6, 32]} />
          <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} emissive="#6b5216" emissiveIntensity={0.4} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * 성모 기도 공간 (왼쪽 측랑): 돌 받침대 위 성모상(Meshy 모델), 벽의 푸른 감실과 금빛 아치, 바닥 카펫.
 * 무릎틀·봉헌 초·묵주 받침은 기존 위치 그대로입니다.
 */
function MaryShrine() {
  const { pedestalH, statueH, rug } = MARY_SHRINE;
  const wallX = -WALL_X + 0.06;
  return (
    <group>
      {/* 바닥 카펫: 이 구역이 따로 마련된 기도 자리임을 보여 줌 */}
      <mesh position={[(rug.minX + rug.maxX) / 2, 0.012, (rug.minZ + rug.maxZ) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[rug.maxX - rug.minX, rug.maxZ - rug.minZ]} />
        <meshStandardMaterial color="#26355e" roughness={0.95} />
      </mesh>
      <mesh position={[(rug.minX + rug.maxX) / 2, 0.014, (rug.minZ + rug.maxZ) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[rug.maxX - rug.minX - 0.25, rug.maxZ - rug.minZ - 0.25]} />
        <meshStandardMaterial color="#2f4274" roughness={0.95} />
      </mesh>
      {/* 벽 감실: 푸른 판과 금빛 아치 */}
      <group position={[wallX, 0, MARY.z]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 1.8, 0]} receiveShadow>
          <planeGeometry args={[1.9, 3.6]} />
          <meshStandardMaterial color="#1d2b52" roughness={0.9} />
        </mesh>
        <mesh position={[0, 3.6, 0.01]}>
          <circleGeometry args={[0.95, 32, 0, Math.PI]} />
          <meshStandardMaterial color="#1d2b52" roughness={0.9} />
        </mesh>
        <mesh position={[0, 3.6, 0.03]}>
          <torusGeometry args={[0.95, 0.04, 8, 40, Math.PI]} />
          <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.35} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.95, 1.8, 0.03]}>
            <boxGeometry args={[0.08, 3.6, 0.06]} />
            <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.35} />
          </mesh>
        ))}
      </group>
      {/* 돌 받침대 */}
      <mesh position={[MARY.x, pedestalH / 2, MARY.z]} castShadow receiveShadow>
        <boxGeometry args={[0.75, pedestalH, 0.75]} />
        <meshStandardMaterial color="#cbbfa8" roughness={0.8} />
      </mesh>
      {/* 꽃 선반: 바친 장미가 성모상 발치에 놓이는 넓은 판 (roses.ts MARY_SHELF_HALF) */}
      <mesh position={[MARY.x + 0.02, pedestalH + 0.02, MARY.z]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.04, 1.6]} />
        <meshStandardMaterial color="#b9ab92" roughness={0.75} />
      </mesh>
      {/* 성모상: Meshy 모델은 +Z 가 정면이라 반 바퀴 돌려 +X(신자석 쪽)를 바라보게 함 */}
      <StatueModel
        url={STATUE_URLS.mary}
        position={[MARY.x, pedestalH + 0.04, MARY.z]}
        rotationY={MARY.yaw + Math.PI}
        height={statueH}
        fallback={<MaryFallback />}
      />
    </group>
  );
}

function CandleRack() {
  const candles = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) out.push([-0.45 + i * 0.18, 0.86 + r * 0.14, -0.1 + r * 0.16]);
    return out;
  }, []);
  return (
    <group position={[CANDLE_RACK.x, 0, CANDLE_RACK.z]} rotation={[0, MARY.yaw, 0]}>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[1.2, 0.8, 0.5]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.88, 0.08]}>
        <boxGeometry args={[1.2, 0.04, 0.5]} />
        <meshStandardMaterial color="#3a3530" metalness={0.6} roughness={0.5} />
      </mesh>
      {candles.map((p, i) => (
        <group key={i} position={p}>
          <mesh>
            <cylinderGeometry args={[0.035, 0.035, 0.08, 8]} />
            <meshStandardMaterial color="#a8322e" roughness={0.5} transparent opacity={0.85} />
          </mesh>
          <Flame position={[0, 0.08, 0]} scale={0.8} seed={i} />
        </group>
      ))}
    </group>
  );
}

function Kneeler() {
  return (
    <group position={[KNEELER.x, 0, KNEELER.z]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[1.0, 0.12, 0.3]} />
        <meshStandardMaterial color="#6b2228" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.5, -0.35]}>
        <boxGeometry args={[1.0, 0.9, 0.08]} />
        <meshStandardMaterial color={WOOD} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.95, -0.3]}>
        <boxGeometry args={[1.1, 0.05, 0.25]} />
        <meshStandardMaterial color={WOOD} roughness={0.7} />
      </mesh>
    </group>
  );
}

export function Furnishings() {
  return (
    <group>
      <PewInstances />
      <Altar />
      <Crucifix />
      <MaryShrine />
      <CandleRack />
      <Kneeler />
    </group>
  );
}
