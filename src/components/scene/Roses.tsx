"use client";
// 꽃: 오른쪽 측랑의 꽃 제단(여섯 가지 꽃), 성모상 발치·제단 위에 바친 꽃, 바닥의 꽃잎과 꽃송이, 손에 든 꽃.
// 같은 모양이 많으므로 꽃 모양마다 InstancedMesh 하나(색은 인스턴스마다)로 그려 그리기 호출이 몇 번에 그치게 합니다.
import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ROSE_ALTAR } from "@/lib/game/chapelLayout";
import { FLOWERS, PETALS_PER_ROSE, ROSE_CAP, ROSE_LEN, petalOffsets, rand, type FlowerShape } from "@/lib/game/roses";
import { getNetworkManager } from "@/lib/net/NetworkManager";
import { Flame } from "./Furnishings";

const STEM_GREEN = "#2f5a2a";
const STEM_LEN = 0.32;
const SHAPES: readonly FlowerShape[] = ["rose", "lily", "tulip", "daisy"];

const lathe = (pts: number[][], seg: number) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
let geos: Record<FlowerShape | "stem" | "petal" | "daisyCenter", THREE.BufferGeometry> | null = null;
/** 꽃 모양 (줄기 끝이 원점, 위로 피어남) */
function flowerGeos() {
  return (geos ??= {
    // 장미: 위가 살짝 벌어진 컵
    rose: lathe([[0, 0], [0.022, 0.006], [0.036, 0.026], [0.04, 0.048], [0.03, 0.06], [0, 0.045]], 10),
    // 백합: 여섯 갈래로 활짝 벌어진 나팔
    lily: lathe([[0.004, 0], [0.01, 0.02], [0.022, 0.05], [0.05, 0.085], [0.07, 0.092]], 6),
    // 튤립: 길쭉하게 오므린 컵
    tulip: lathe([[0, 0], [0.024, 0.006], [0.034, 0.03], [0.033, 0.062], [0.022, 0.08], [0, 0.07]], 10),
    // 데이지: 납작하게 펼친 흰 꽃잎 (가운데 노란 부분은 daisyCenter)
    daisy: new THREE.CylinderGeometry(0.052, 0.052, 0.006, 14).translate(0, 0.006, 0),
    daisyCenter: new THREE.SphereGeometry(0.016, 8, 6).scale(1, 0.55, 1).translate(0, 0.012, 0),
    stem: new THREE.CylinderGeometry(0.004, 0.005, STEM_LEN, 5).translate(0, STEM_LEN / 2, 0),
    petal: new THREE.CircleGeometry(0.045, 7).scale(1, 0.7, 1).rotateX(-Math.PI / 2),
  });
}

const stemMat = new THREE.MeshStandardMaterial({ color: STEM_GREEN, roughness: 0.8 });
const centerMat = new THREE.MeshStandardMaterial({ color: "#e8b923", roughness: 0.7 });
/** 색은 인스턴스마다 (흰색 바탕에 instanceColor 를 곱함) */
const bloomMat = (shape: FlowerShape) =>
  new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: shape === "lily" ? 0.5 : 0.6, side: shape === "lily" ? THREE.DoubleSide : THREE.FrontSide });
const petalMat = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#1a0508", roughness: 0.6, side: THREE.DoubleSide });

const tmp = new THREE.Object3D();
const col = new THREE.Color();

type Meshes = Record<FlowerShape, THREE.InstancedMesh | null> & { stem: THREE.InstancedMesh | null; center: THREE.InstancedMesh | null };
type Counts = Record<FlowerShape | "stem" | "center", number>;
const emptyCounts = (): Counts => ({ rose: 0, lily: 0, tulip: 0, daisy: 0, stem: 0, center: 0 });

/** 줄기와 꽃송이 한 송이를 모양별 instanced mesh 에 기록 */
function writeFlower(m: Meshes, c: Counts, base: THREE.Object3D, flower: number) {
  const kind = FLOWERS[flower] ?? FLOWERS[0];
  base.updateMatrix();
  m.stem?.setMatrixAt(c.stem++, base.matrix);
  tmp.position.set(0, STEM_LEN, 0);
  tmp.rotation.set(0, 0, 0);
  tmp.scale.set(1, 1, 1);
  tmp.updateMatrix();
  const bloomMatrix = base.matrix.clone().multiply(tmp.matrix);
  const mesh = m[kind.shape];
  if (mesh) {
    mesh.setMatrixAt(c[kind.shape], bloomMatrix);
    mesh.setColorAt(c[kind.shape]++, col.set(kind.color));
  }
  if (kind.shape === "daisy" && m.center) m.center.setMatrixAt(c.center++, bloomMatrix);
}

function finish(m: Meshes, c: Counts) {
  for (const k of [...SHAPES, "stem", "center"] as const) {
    const mesh = m[k];
    if (!mesh) continue;
    mesh.count = c[k];
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

/** 모양별 instanced mesh 묶음 (줄기·데이지 가운데 포함) */
function FlowerMeshes({ refs, capacity, castShadow = false }: { refs: React.MutableRefObject<Meshes>; capacity: number; castShadow?: boolean }) {
  const g = flowerGeos();
  const mats = useMemo(() => Object.fromEntries(SHAPES.map((s) => [s, bloomMat(s)])) as Record<FlowerShape, THREE.MeshStandardMaterial>, []);
  return (
    <group>
      <instancedMesh ref={(el) => void (refs.current.stem = el)} args={[g.stem, stemMat, capacity]} frustumCulled={false} />
      {SHAPES.map((s) => (
        <instancedMesh key={s} ref={(el) => void (refs.current[s] = el)} args={[g[s], mats[s], capacity]} frustumCulled={false} castShadow={castShadow} />
      ))}
      <instancedMesh ref={(el) => void (refs.current.center = el)} args={[g.daisyCenter, centerMat, capacity]} frustumCulled={false} />
    </group>
  );
}

const emptyMeshes = (): Meshes => ({ rose: null, lily: null, tulip: null, daisy: null, stem: null, center: null });

/** 꽃 제단: 흰 천을 덮은 나무 탁자 위, 꽃 종류마다 꽃병 하나씩, 양쪽 초, 붉은 카펫 */
function FlowerAltarModel() {
  const refs = useRef<Meshes>(emptyMeshes());
  const perVase = 7;
  const top = ROSE_ALTAR.height;
  const vases = useMemo(() => FLOWERS.map((_, i) => (i - (FLOWERS.length - 1) / 2) * 0.36), []);

  useLayoutEffect(() => {
    const c = emptyCounts();
    const o = new THREE.Object3D();
    vases.forEach((vz, v) => {
      for (let k = 0; k < perVase; k++) {
        const a = (k / perVase) * Math.PI * 2 + v;
        const lean = k === 0 ? 0 : 0.16 + rand(v * 10 + k, 1) * 0.14;
        o.position.set(Math.cos(a) * 0.018, top + 0.2, vz + Math.sin(a) * 0.018);
        o.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
        o.scale.setScalar(0.9 + rand(v * 10 + k, 2) * 0.2);
        writeFlower(refs.current, c, o, v);
      }
    });
    finish(refs.current, c);
  }, [vases, top]);

  return (
    <group position={[ROSE_ALTAR.x, 0, ROSE_ALTAR.z]}>
      {/* 카펫 */}
      <mesh position={[-0.9, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.8, ROSE_ALTAR.width + 0.6]} />
        <meshStandardMaterial color="#5c1720" roughness={0.95} />
      </mesh>
      {/* 탁자 */}
      <mesh position={[0, top / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[ROSE_ALTAR.depth, top, ROSE_ALTAR.width]} />
        <meshStandardMaterial color="#5a3820" roughness={0.75} />
      </mesh>
      {/* 흰 천 */}
      <mesh position={[0, top + 0.008, 0]}>
        <boxGeometry args={[ROSE_ALTAR.depth + 0.06, 0.016, ROSE_ALTAR.width + 0.06]} />
        <meshStandardMaterial color="#f3eee2" roughness={0.9} />
      </mesh>
      <mesh position={[-ROSE_ALTAR.depth / 2 - 0.035, top - 0.2, 0]}>
        <boxGeometry args={[0.012, 0.38, ROSE_ALTAR.width + 0.06]} />
        <meshStandardMaterial color="#f3eee2" roughness={0.9} />
      </mesh>
      {/* 꽃병 */}
      {vases.map((vz) => (
        <mesh key={vz} position={[0, top + 0.11, vz]} castShadow>
          <cylinderGeometry args={[0.05, 0.065, 0.22, 12]} />
          <meshStandardMaterial color="#c9a44a" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <FlowerMeshes refs={refs} capacity={FLOWERS.length * perVase} castShadow />
      {/* 양쪽 초 */}
      {[-1, 1].map((s, i) => (
        <group key={s} position={[0.05, top, s * (ROSE_ALTAR.width / 2 - 0.08)]}>
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.18, 8]} />
            <meshStandardMaterial color="#f4ecd8" roughness={0.6} />
          </mesh>
          <Flame position={[0, 0.2, 0]} scale={0.8} seed={i + 20} />
        </group>
      ))}
    </group>
  );
}

const MAX_OFFERED = ROSE_CAP.mary + ROSE_CAP.jesus + ROSE_CAP.floorRose;
const MAX_PETALS = ROSE_CAP.floor * PETALS_PER_ROSE;

/** 바친 꽃·바닥에 놓은 꽃송이(눕힌 꽃)와 바닥에 뿌린 꽃잎 */
function OfferedFlowers() {
  const store = getNetworkManager().roses;
  const version = useSyncExternalStore(
    (fn) => store.subscribe(fn),
    () => store.version,
    () => 0,
  );
  const refs = useRef<Meshes>(emptyMeshes());
  const petals = useRef<THREE.InstancedMesh>(null);

  // 12시간이 지난 꽃이 저절로 사라지도록 가끔 다시 그림
  const tick = useRef(0);
  useFrame((_, dt) => {
    tick.current += dt;
    if (tick.current > 60) {
      tick.current = 0;
      draw();
    }
  });

  const draw = () => {
    const p = petals.current;
    if (!p) return;
    const c = emptyCounts();
    const o = new THREE.Object3D();
    let np = 0;
    for (const r of store.all()) {
      if (r.target === "floor") {
        const petalColor = col.set((FLOWERS[r.flower] ?? FLOWERS[0]).petal).clone();
        for (const pt of petalOffsets(r.seed)) {
          if (np >= MAX_PETALS) break;
          o.position.set(r.x + pt.dx, r.y + 0.002 * (np % 3), r.z + pt.dz);
          o.rotation.set(0, pt.rot, 0);
          o.scale.setScalar(1);
          o.updateMatrix();
          p.setMatrixAt(np, o.matrix);
          p.setColorAt(np++, petalColor);
        }
      } else if (c.stem < MAX_OFFERED) {
        // 줄기를 수평으로(z축 기준 -90°), yaw 로 방향을 돌림. 멀리서도 보이도록 손에 든 꽃보다 크게
        o.position.set(r.x, r.y + 0.012, r.z);
        o.rotation.set(0, r.yaw, -Math.PI / 2, "YXZ");
        o.scale.setScalar(ROSE_LEN / STEM_LEN);
        writeFlower(refs.current, c, o, r.flower);
      }
    }
    finish(refs.current, c);
    p.count = np;
    p.instanceMatrix.needsUpdate = true;
    if (p.instanceColor) p.instanceColor.needsUpdate = true;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(draw, [version, store]);

  return (
    <group>
      <FlowerMeshes refs={refs} capacity={MAX_OFFERED} />
      <instancedMesh ref={petals} args={[flowerGeos().petal, petalMat, MAX_PETALS]} frustumCulled={false} />
    </group>
  );
}

/**
 * 손에 든 꽃 한 송이 (아바타 안에서 쓰임). getHeldFlower 가 꽃 번호를 돌려줄 때만 보이고, 종류에 맞는 모양·색으로 바뀜
 */
export function HeldRose({ position, getHeldFlower }: { position: [number, number, number]; getHeldFlower?: () => number | null }) {
  const group = useRef<THREE.Group>(null);
  const blooms = useRef<Partial<Record<FlowerShape, THREE.Mesh>>>({});
  const center = useRef<THREE.Mesh>(null);
  const g = flowerGeos();
  const mats = useMemo(() => Object.fromEntries(SHAPES.map((s) => [s, bloomMat(s)])) as Record<FlowerShape, THREE.MeshStandardMaterial>, []);
  useFrame(() => {
    const f = getHeldFlower?.() ?? null;
    if (!group.current) return;
    group.current.visible = f !== null;
    if (f === null) return;
    const kind = FLOWERS[f] ?? FLOWERS[0];
    for (const s of SHAPES) {
      const m = blooms.current[s];
      if (!m) continue;
      m.visible = s === kind.shape;
      if (m.visible) mats[s].color.set(kind.color);
    }
    if (center.current) center.current.visible = kind.shape === "daisy";
  });
  return (
    <group ref={group} position={position} rotation={[0.35, 0, 0.15]} visible={false}>
      <mesh geometry={g.stem} material={stemMat} />
      {SHAPES.map((s) => (
        <mesh key={s} ref={(el) => void (el && (blooms.current[s] = el))} geometry={g[s]} material={mats[s]} position={[0, STEM_LEN, 0]} scale={1.3} />
      ))}
      <mesh ref={center} geometry={g.daisyCenter} material={centerMat} position={[0, STEM_LEN, 0]} scale={1.3} />
    </group>
  );
}

export function Roses() {
  return (
    <group>
      <FlowerAltarModel />
      <OfferedFlowers />
    </group>
  );
}
