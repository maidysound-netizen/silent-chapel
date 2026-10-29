"use client";
// 클릭할 수 있는 묵주와 성경. 가까이 가면 은은하게 빛나 상호작용할 수 있음을 알려 줍니다.
import { useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { AMBO, ROSARY_STAND } from "@/lib/game/chapelLayout";
import { useApp } from "@/store/useAppStore";
import { pointerDrag } from "./pointerDrag";

function useClickable(onActivate: () => void) {
  const [hover, setHover] = useState(false);
  return {
    hover,
    handlers: {
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "pointer";
      },
      onPointerOut: () => {
        setHover(false);
        document.body.style.cursor = "";
      },
      onClick: (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (pointerDrag.moved) return; // 시점 드래그 끝에 생긴 클릭은 무시
        onActivate();
      },
    },
  };
}

/** 위아래로 천천히 떠 있는 작은 빛 — '여기를 눌러 보세요' 표시 */
function Beacon({ position, active }: { position: [number, number, number]; active: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 1.4) * 0.05;
    const m = ref.current.material as THREE.MeshBasicMaterial;
    m.opacity = (active ? 0.85 : 0.45) + Math.sin(clock.elapsedTime * 2) * 0.1;
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.05, 12, 8]} />
      <meshBasicMaterial color="#ffe6a8" transparent opacity={0.5} toneMapped={false} />
    </mesh>
  );
}

function RosaryBeads({ glow }: { glow: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 59;
  const matrices = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    // 고리 (54알) — 타원 모양으로 쿠션 위에 놓임
    for (let i = 0; i < 54; i++) {
      const a = (i / 54) * Math.PI * 2;
      const big = i % 11 === 0;
      const s = big ? 1.5 : 1;
      m.compose(new THREE.Vector3(Math.cos(a) * 0.16, 0, Math.sin(a) * 0.11 - 0.02), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      out.push(m.clone());
    }
    // 펜던트 (큰 알 1 + 작은 알 3 + 큰 알 1)
    for (let i = 0; i < 5; i++) {
      const s = i === 0 || i === 4 ? 1.5 : 1;
      m.compose(new THREE.Vector3(0, 0, 0.1 + i * 0.026), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      out.push(m.clone());
    }
    return out;
  }, []);
  useFrame(() => {
    if (!ref.current) return;
    if (!ref.current.userData.init) {
      matrices.forEach((m, i) => ref.current!.setMatrixAt(i, m));
      ref.current.instanceMatrix.needsUpdate = true;
      ref.current.computeBoundingSphere();
      ref.current.userData.init = true;
    }
    (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity = glow;
  });
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.009, 8, 6]} />
        <meshStandardMaterial color="#8a5a3a" roughness={0.35} emissive="#ffcf80" emissiveIntensity={0} />
      </instancedMesh>
      {/* 작은 십자가 */}
      <mesh position={[0, 0, 0.26]}>
        <boxGeometry args={[0.008, 0.004, 0.06]} />
        <meshStandardMaterial color="#c9a44a" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.245]}>
        <boxGeometry args={[0.035, 0.004, 0.008]} />
        <meshStandardMaterial color="#c9a44a" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

export function RosaryObject() {
  const openPanel = useApp((s) => s.openPanel);
  const near = useApp((s) => s.prompt?.kind === "rosary");
  const { hover, handlers } = useClickable(() => openPanel("rosary"));
  const active = hover || near;
  return (
    <group position={[ROSARY_STAND.x, 0, ROSARY_STAND.z]}>
      {/* 작은 받침대 */}
      <mesh position={[0, ROSARY_STAND.y / 2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, ROSARY_STAND.y, 12]} />
        <meshStandardMaterial color="#5a3a24" roughness={0.7} />
      </mesh>
      {/* 쿠션 (클릭 범위를 넉넉하게) */}
      <mesh position={[0, ROSARY_STAND.y + 0.03, 0]} {...handlers}>
        <boxGeometry args={[0.5, 0.06, 0.5]} />
        <meshStandardMaterial color={active ? "#8a2f36" : "#6b2228"} roughness={0.95} />
      </mesh>
      <group position={[0, ROSARY_STAND.y + 0.07, 0]} rotation={[0, Math.PI / 2, 0]}>
        <RosaryBeads glow={active ? 0.6 : 0.08} />
      </group>
      <Beacon position={[0, ROSARY_STAND.y + 0.45, 0]} active={active} />
      <pointLight position={[0, ROSARY_STAND.y + 0.5, 0]} intensity={active ? 0.6 : 0} distance={2} color="#ffd9a0" />
    </group>
  );
}

export function BibleObject() {
  const openPanel = useApp((s) => s.openPanel);
  const near = useApp((s) => s.prompt?.kind === "bible");
  const { hover, handlers } = useClickable(() => openPanel("bible"));
  const active = hover || near;
  return (
    <group position={[AMBO.x, 0, AMBO.z]}>
      {/* 독서대 */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.5, 1.1, 0.4]} />
        <meshStandardMaterial color="#5a3a24" roughness={0.7} />
      </mesh>
      <mesh position={[0, AMBO.y - 0.05, 0]} rotation={[-0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.7, 0.05, 0.5]} />
        <meshStandardMaterial color="#4a2e1b" roughness={0.7} />
      </mesh>
      {/* 펼친 성경 */}
      <group position={[0, AMBO.y + 0.01, 0]} rotation={[-0.35, 0, 0]} {...handlers}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.13, 0.02, 0]} rotation={[0, 0, -s * 0.08]}>
            <boxGeometry args={[0.25, 0.03, 0.34]} />
            <meshStandardMaterial color={active ? "#fff8e6" : "#efe6d0"} emissive="#ffe8b0" emissiveIntensity={active ? 0.35 : 0.03} roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, -0.005, 0]}>
          <boxGeometry args={[0.54, 0.02, 0.36]} />
          <meshStandardMaterial color="#5c1a1a" roughness={0.6} />
        </mesh>
        {/* 리본 책갈피 */}
        <mesh position={[0.02, 0.04, 0.2]}>
          <boxGeometry args={[0.012, 0.004, 0.12]} />
          <meshStandardMaterial color="#b0262c" />
        </mesh>
      </group>
      <Beacon position={[0, AMBO.y + 0.45, 0]} active={active} />
      <pointLight position={[0, AMBO.y + 0.5, 0.2]} intensity={active ? 0.6 : 0} distance={2} color="#ffd9a0" />
    </group>
  );
}
