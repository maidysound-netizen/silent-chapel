"use client";
// 장미꽃: 오른쪽 측랑의 장미 제단, 성모상·제단 앞에 바친 꽃, 바닥에 뿌린 꽃잎, 손에 든 꽃.
// 같은 모양이 많으므로 InstancedMesh 로 그려 휴대폰에서도 그리기 호출이 몇 번에 그치게 합니다.
import { useLayoutEffect, useMemo, useRef, useSyncExternalStore, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ROSE_ALTAR } from "@/lib/game/chapelLayout";
import { PETALS_PER_ROSE, ROSE_CAP, ROSE_LEN, petalOffsets, rand } from "@/lib/game/roses";
import { getNetworkManager } from "@/lib/net/NetworkManager";
import { Flame } from "./Furnishings";

const ROSE_RED = "#a3162a";
const STEM_GREEN = "#2f5a2a";
const STEM_LEN = 0.32;

let bloomG: THREE.BufferGeometry | null = null;
let stemG: THREE.BufferGeometry | null = null;
let petalG: THREE.BufferGeometry | null = null;
/** 꽃송이: 위가 살짝 벌어진 컵 모양 */
const bloomGeo = () =>
  (bloomG ??= new THREE.LatheGeometry(
    [
      [0, 0],
      [0.022, 0.006],
      [0.036, 0.026],
      [0.04, 0.048],
      [0.03, 0.06],
      [0, 0.045],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    10,
  ));
const stemGeo = () => (stemG ??= new THREE.CylinderGeometry(0.004, 0.005, STEM_LEN, 5).translate(0, STEM_LEN / 2, 0));
const petalGeo = () => (petalG ??= new THREE.CircleGeometry(0.045, 7).scale(1, 0.7, 1).rotateX(-Math.PI / 2));

const bloomMat = new THREE.MeshStandardMaterial({ color: ROSE_RED, roughness: 0.6 });
const stemMat = new THREE.MeshStandardMaterial({ color: STEM_GREEN, roughness: 0.8 });
const petalMat = new THREE.MeshStandardMaterial({ color: "#d12a40", emissive: "#3a0610", roughness: 0.6, side: THREE.DoubleSide });

const tmp = new THREE.Object3D();

/** 줄기와 꽃송이 한 쌍을 instanced mesh 두 개에 기록 */
function writeRose(blooms: THREE.InstancedMesh, stems: THREE.InstancedMesh, i: number, base: THREE.Object3D) {
  base.updateMatrix();
  stems.setMatrixAt(i, base.matrix);
  tmp.position.set(0, STEM_LEN, 0);
  tmp.rotation.set(0, 0, 0);
  tmp.scale.set(1, 1, 1);
  tmp.updateMatrix();
  blooms.setMatrixAt(i, base.matrix.clone().multiply(tmp.matrix));
}

/** 장미 제단: 흰 천을 덮은 나무 탁자 위 꽃병 세 개, 양쪽 초, 붉은 카펫 */
function RoseAltarModel() {
  const blooms = useRef<THREE.InstancedMesh>(null);
  const stems = useRef<THREE.InstancedMesh>(null);
  const vases = useMemo(() => [-0.5, 0, 0.5], []);
  const perVase = 9;
  const top = ROSE_ALTAR.height;

  useLayoutEffect(() => {
    const b = blooms.current;
    const st = stems.current;
    if (!b || !st) return;
    const o = new THREE.Object3D();
    let i = 0;
    vases.forEach((vz, v) => {
      for (let k = 0; k < perVase; k++) {
        const a = (k / perVase) * Math.PI * 2 + v;
        const lean = k === 0 ? 0 : 0.18 + rand(v * 10 + k, 1) * 0.15;
        o.position.set(Math.cos(a) * 0.02, top + 0.2, vz + Math.sin(a) * 0.02);
        o.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
        o.scale.setScalar(0.9 + rand(v * 10 + k, 2) * 0.25);
        writeRose(b, st, i++, o);
      }
    });
    b.instanceMatrix.needsUpdate = true;
    st.instanceMatrix.needsUpdate = true;
  }, [vases, top]);

  const n = vases.length * perVase;
  return (
    <group position={[ROSE_ALTAR.x, 0, ROSE_ALTAR.z]}>
      {/* 카펫 */}
      <mesh position={[-0.9, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.8, 2.6]} />
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
      <instancedMesh ref={stems} args={[stemGeo(), stemMat, n]} />
      <instancedMesh ref={blooms} args={[bloomGeo(), bloomMat, n]} castShadow />
      {/* 양쪽 초 */}
      {[-0.72, 0.72].map((z, i) => (
        <group key={z} position={[0.05, top, z]}>
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

const MAX_OFFERED = ROSE_CAP.mary + ROSE_CAP.jesus;
const MAX_PETALS = ROSE_CAP.floor * PETALS_PER_ROSE;

/** 바친 꽃(눕혀 놓은 장미)과 바닥에 뿌린 꽃잎 */
function OfferedRoses() {
  const net = getNetworkManager();
  const store = net.roses;
  const version = useSyncExternalStore(
    (fn) => store.subscribe(fn),
    () => store.version,
    () => 0,
  );
  const blooms = useRef<THREE.InstancedMesh>(null);
  const stems = useRef<THREE.InstancedMesh>(null);
  const petals = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const b = blooms.current;
    const s = stems.current;
    const p = petals.current;
    if (!b || !s || !p) return;
    const o = new THREE.Object3D();
    let ni = 0;
    let np = 0;
    for (const r of store.all()) {
      if (r.target === "floor") {
        for (const pt of petalOffsets(r.seed)) {
          if (np >= MAX_PETALS) break;
          o.position.set(r.x + pt.dx, r.y + 0.002 * (np % 3), r.z + pt.dz);
          o.rotation.set(0, pt.rot, 0);
          o.scale.setScalar(1);
          o.updateMatrix();
          p.setMatrixAt(np++, o.matrix);
        }
      } else if (ni < MAX_OFFERED) {
        // 바닥에 눕힌 장미: 줄기를 수평으로(z축 기준 -90°), yaw 로 방향을 돌림
        o.position.set(r.x, r.y + 0.012, r.z);
        o.rotation.set(0, r.yaw, -Math.PI / 2, "YXZ");
        o.scale.setScalar(ROSE_LEN / STEM_LEN); // 멀리서도 보이도록 손에 든 꽃보다 크게
        writeRose(b, s, ni++, o);
      }
    }
    b.count = ni;
    s.count = ni;
    p.count = np;
    b.instanceMatrix.needsUpdate = true;
    s.instanceMatrix.needsUpdate = true;
    p.instanceMatrix.needsUpdate = true;
  }, [version, store]);

  return (
    <group>
      <instancedMesh ref={stems} args={[stemGeo(), stemMat, MAX_OFFERED]} frustumCulled={false} />
      <instancedMesh ref={blooms} args={[bloomGeo(), bloomMat, MAX_OFFERED]} frustumCulled={false} />
      <instancedMesh ref={petals} args={[petalGeo(), petalMat, MAX_PETALS]} frustumCulled={false} />
    </group>
  );
}

/** 손에 든 장미 한 송이 (아바타 안에서 쓰임). getHolding 이 true 일 때만 보임 */
export function HeldRose({ position, getHolding }: { position: [number, number, number]; getHolding?: () => boolean }) {
  const ref = useRef<THREE.Group>(null);
  useHeldVisibility(ref, getHolding);
  return (
    <group ref={ref} position={position} rotation={[0.35, 0, 0.15]} visible={false}>
      <mesh geometry={stemGeo()} material={stemMat} />
      <mesh geometry={bloomGeo()} material={bloomMat} position={[0, STEM_LEN, 0]} scale={1.3} />
    </group>
  );
}

function useHeldVisibility(ref: RefObject<THREE.Group | null>, getHolding?: () => boolean) {
  useFrame(() => {
    if (ref.current) ref.current.visible = !!getHolding?.();
  });
}

export function Roses() {
  return (
    <group>
      <RoseAltarModel />
      <OfferedRoses />
    </group>
  );
}
