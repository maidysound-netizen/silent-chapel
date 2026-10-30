"use client";
// 은은한 간접 조명. 품질 설정에 따라 조명 수와 그림자를 줄입니다.
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ALTAR, CANDLE_RACK, CRUCIFIX, MARY, MARY_SHRINE, SANCTUARY_Y } from "@/lib/game/chapelLayout";
import type { Quality } from "@/store/useAppStore";

function FlickerLight({ position, base, color, distance }: { position: [number, number, number]; base: number; color: string; distance: number }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.intensity = base * (1 + Math.sin(t * 5.3 + position[0]) * 0.04 + Math.sin(t * 9.1) * 0.03);
  });
  return <pointLight ref={ref} position={position} color={color} intensity={base} distance={distance} decay={2} />;
}

/** 창으로 들어오는 빛줄기 (반투명 판, 가산 혼합) */
function LightShafts() {
  const zs = [-12.5, -7.5, -2.5, 2.5, 7.5];
  return (
    <group>
      {zs.map((z) => (
        <mesh key={z} position={[-3.2, 7.5, z + 1.5]} rotation={[0.35, 0, -0.6]}>
          <planeGeometry args={[1.4, 14]} />
          <meshBasicMaterial color="#ffe2b0" transparent opacity={0.045} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

export function Lighting({ quality }: { quality: Quality }) {
  const spot = useRef<THREE.SpotLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const marySpot = useRef<THREE.SpotLight>(null);
  const high = quality === "high";
  const low = quality === "low";

  useEffect(() => {
    if (spot.current) {
      spot.current.target.position.set(CRUCIFIX.x, CRUCIFIX.focusY - 0.6, CRUCIFIX.z);
      spot.current.target.updateMatrixWorld();
    }
    if (marySpot.current) {
      marySpot.current.target.position.set(MARY.x, MARY_SHRINE.pedestalH + MARY_SHRINE.statueH * 0.6, MARY.z);
      marySpot.current.target.updateMatrixWorld();
    }
    if (sun.current) {
      sun.current.target.position.set(0, 0, -2);
      sun.current.target.updateMatrixWorld();
    }
  }, [quality]);

  return (
    <>
      <color attach="background" args={["#120d09"]} />
      <fog attach="fog" args={["#1a130d", 20, 62]} />
      <hemisphereLight args={["#b9c4dc", "#3a2a1c", low ? 0.75 : 0.55]} />
      <ambientLight intensity={low ? 0.35 : 0.22} color="#ffe9cc" />

      {/* 왼쪽 창으로 들어오는 오후 햇빛 */}
      <directionalLight
        ref={sun}
        position={[-14, 16, 4]}
        intensity={high ? 1.1 : 0.8}
        color="#ffe3b8"
        castShadow={high}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={50}
        shadow-bias={-0.0005}
      />

      {/* 십자가를 비추는 스포트라이트 */}
      <spotLight
        ref={spot}
        position={[0, 12, -12]}
        angle={0.42}
        penumbra={0.7}
        intensity={low ? 90 : 120}
        distance={30}
        decay={1.6}
        color="#fff0d6"
        castShadow={high}
      />

      {/* 제단 촛불 */}
      <FlickerLight position={[ALTAR.x, SANCTUARY_Y + 2, ALTAR.z + 0.6]} base={low ? 3 : 4} color="#ffc27a" distance={9} />
      {!low && (
        <>
          {/* 성모상과 봉헌 초 */}
          <FlickerLight position={[CANDLE_RACK.x + 0.8, 1.4, CANDLE_RACK.z]} base={2.4} color="#ffb766" distance={6} />
          {/* 성모상을 앞 위에서 비추는 부드러운 빛 (높은 품질에서만 그림자) */}
          <spotLight
            ref={marySpot}
            position={[MARY.x + 2.4, 4.6, MARY.z + 0.4]}
            angle={0.45}
            penumbra={0.8}
            intensity={22}
            distance={9}
            decay={1.8}
            color="#e8ecff"
            castShadow={high}
            shadow-mapSize-width={512}
            shadow-mapSize-height={512}
            shadow-bias={-0.0008}
          />
        </>
      )}
      {high && (
        <>
          <pointLight position={[0, 5, 2]} intensity={6} distance={18} color="#ffd8a8" decay={2} />
          <pointLight position={[0, 5, 10]} intensity={4} distance={14} color="#ffd8a8" decay={2} />
        </>
      )}
      {!low && <LightShafts />}
    </>
  );
}
