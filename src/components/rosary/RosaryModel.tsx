"use client";
// 3D 묵주 모델. 기도 진행에 따라 알의 색이 바뀌고, 지금 기도하는 알은 손가락 사이에서 굴러가듯 회전합니다.
// 묵주기도 패널의 3D 뷰와 성당 안 받침대 위 묵주가 같은 모델을 씁니다.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildRosaryShape, chainPaths, type BeadPlacement } from "@/lib/rosary/rosaryShape";

export type BeadState = "todo" | "done" | "current";

const WOOD = new THREE.Color("#5b341c");
const GOLD = new THREE.Color("#e2c172");
const GLOW = new THREE.Color("#fff0c4");
const EMIT_DONE = new THREE.Color("#4a3208");
const EMIT_CUR = new THREE.Color("#ffc96a");
const BLACK = new THREE.Color("#000000");

const SHAPE = buildRosaryShape();
export const SHAPE_BY_KEY = new Map(SHAPE.map((b) => [b.key, b]));

const sphereGeo = new THREE.SphereGeometry(1, 24, 18);

function Bead({ bead, state, onPick }: { bead: BeadPlacement; state: BeadState; onPick?: () => void }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshPhysicalMaterial>(null);
  const spin = useRef(0); // 남은 회전 속도 (굴러가는 효과)
  const prev = useRef<BeadState>(state);

  useEffect(() => {
    // 지금 알에서 다음 알로 넘어가는 순간 → 한 바퀴 굴러감
    if (prev.current === "current" && state !== "current") spin.current = 14;
    if (state === "current" && prev.current !== "current") spin.current = 8;
    prev.current = state;
  }, [state]);

  useFrame((_, delta) => {
    const m = mesh.current;
    const mt = mat.current;
    if (!m || !mt) return;
    const k = 1 - Math.exp(-delta * 6);
    const targetColor = state === "current" ? GLOW : state === "done" ? GOLD : WOOD;
    const targetEmit = state === "current" ? EMIT_CUR : state === "done" ? EMIT_DONE : BLACK;
    mt.color.lerp(targetColor, k);
    mt.emissive.lerp(targetEmit, k);
    mt.metalness += ((state === "todo" ? 0.05 : 0.55) - mt.metalness) * k;
    const s = bead.radius * (state === "current" ? 1.35 : 1);
    m.scale.setScalar(m.scale.x + (s - m.scale.x) * k);
    // 줄을 축으로 굴러가는 회전 + 지금 알은 천천히 계속 회전
    spin.current *= Math.exp(-delta * 3);
    m.rotation.x += (spin.current + (state === "current" ? 1.2 : 0)) * delta;
  });

  return (
    <mesh
      ref={mesh}
      geometry={sphereGeo}
      position={bead.position}
      scale={bead.radius}
      onClick={
        onPick
          ? (e) => {
              e.stopPropagation();
              onPick();
            }
          : undefined
      }
    >
      <meshPhysicalMaterial ref={mat} color={WOOD} roughness={0.32} clearcoat={1} clearcoatRoughness={0.12} metalness={0.05} />
    </mesh>
  );
}

const GOLD_METAL = { color: "#cfae62", metalness: 0.85, roughness: 0.28 } as const;

function Crucifix({ bead, state }: { bead: BeadPlacement; state: BeadState }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (g.current) g.current.rotation.y = state === "current" ? Math.sin(clock.elapsedTime * 1.5) * 0.25 : 0;
  });
  const glow = state === "current" ? 0.6 : state === "done" ? 0.15 : 0;
  return (
    <group ref={g} position={bead.position}>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.05, 0.36, 0.035]} />
        <meshPhysicalMaterial color="#4a2c19" roughness={0.4} clearcoat={0.8} emissive="#ffcf70" emissiveIntensity={glow} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.22, 0.05, 0.035]} />
        <meshPhysicalMaterial color="#4a2c19" roughness={0.4} clearcoat={0.8} emissive="#ffcf70" emissiveIntensity={glow} />
      </mesh>
      {/* 작은 금빛 십자가상 */}
      <mesh position={[0, 0.05, 0.022]}>
        <boxGeometry args={[0.018, 0.16, 0.01]} />
        <meshStandardMaterial {...GOLD_METAL} />
      </mesh>
      <mesh position={[0, 0.1, 0.022]}>
        <boxGeometry args={[0.15, 0.014, 0.01]} />
        <meshStandardMaterial {...GOLD_METAL} />
      </mesh>
      <mesh position={[0, 0.16, 0.022]}>
        <sphereGeometry args={[0.013, 10, 8]} />
        <meshStandardMaterial {...GOLD_METAL} />
      </mesh>
      {/* 고리 */}
      <mesh position={[0, 0.22, 0]}>
        <torusGeometry args={[0.022, 0.006, 6, 16]} />
        <meshStandardMaterial {...GOLD_METAL} />
      </mesh>
    </group>
  );
}

function Medal({ bead, state }: { bead: BeadPlacement; state: BeadState }) {
  const glow = state === "current" ? 0.7 : state === "done" ? 0.2 : 0.05;
  return (
    <group position={bead.position}>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 1.3]}>
        <cylinderGeometry args={[0.085, 0.085, 0.022, 28]} />
        <meshStandardMaterial {...GOLD_METAL} emissive="#ffcf70" emissiveIntensity={glow} />
      </mesh>
      {/* 메달 가운데 양각 (단순한 십자 문양) */}
      <mesh position={[0, 0, 0.013]}>
        <boxGeometry args={[0.012, 0.07, 0.004]} />
        <meshStandardMaterial color="#f2dc9a" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.012, 0.013]}>
        <boxGeometry args={[0.045, 0.012, 0.004]} />
        <meshStandardMaterial color="#f2dc9a" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Chains() {
  const { pendantGeo, loopGeo } = useMemo(() => {
    const { pendant, loop } = chainPaths(SHAPE);
    const toV = (p: [number, number, number]) => new THREE.Vector3(...p);
    return {
      pendantGeo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pendant.map(toV)), 48, 0.007, 6, false),
      loopGeo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loop.map(toV), true), 240, 0.007, 6, true),
    };
  }, []);
  return (
    <>
      <mesh geometry={pendantGeo}>
        <meshStandardMaterial {...GOLD_METAL} />
      </mesh>
      <mesh geometry={loopGeo}>
        <meshStandardMaterial {...GOLD_METAL} />
      </mesh>
    </>
  );
}

/** 지금 기도하는 알 주변의 따뜻한 빛 — 손가락이 묵주를 따라가는 느낌 */
function FingerLight({ currentKey, intensity }: { currentKey: string | null; intensity: number }) {
  const light = useRef<THREE.PointLight>(null);
  const halo = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, delta) => {
    const b = currentKey ? SHAPE_BY_KEY.get(currentKey) : undefined;
    if (!b || !light.current || !halo.current) return;
    const k = 1 - Math.exp(-delta * 7);
    light.current.position.x += (b.position[0] - light.current.position.x) * k;
    light.current.position.y += (b.position[1] - light.current.position.y) * k;
    light.current.position.z += (b.position[2] + 0.25 - light.current.position.z) * k;
    halo.current.position.set(light.current.position.x, light.current.position.y, light.current.position.z - 0.25);
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.2) * 0.08;
    halo.current.scale.setScalar(b.radius * 2.6 * pulse);
  });
  return (
    <>
      <pointLight ref={light} intensity={intensity} distance={1.2} color="#ffd38a" />
      <mesh ref={halo}>
        <ringGeometry args={[0.8, 1, 40]} />
        <meshBasicMaterial color="#ffe3a6" transparent opacity={currentKey ? 0.35 : 0} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

export interface RosaryModelProps {
  done: ReadonlySet<string>;
  currentKey: string | null;
  /** 다음에 기도할 알을 눌렀을 때 */
  onPickBead?: (key: string) => void;
  showFinger?: boolean;
}

export function RosaryModel({ done, currentKey, onPickBead, showFinger = true }: RosaryModelProps) {
  const stateOf = (key: string): BeadState => (key === currentKey ? "current" : done.has(key) ? "done" : "todo");
  return (
    <group>
      <Chains />
      {SHAPE.map((b) =>
        b.kind === "cross" ? (
          <Crucifix key={b.key} bead={b} state={stateOf(b.key)} />
        ) : b.kind === "medal" ? (
          <Medal key={b.key} bead={b} state={stateOf(b.key)} />
        ) : (
          <Bead key={b.key} bead={b} state={stateOf(b.key)} onPick={onPickBead ? () => onPickBead(b.key) : undefined} />
        ),
      )}
      {showFinger && <FingerLight currentKey={currentKey} intensity={1.6} />}
    </group>
  );
}
