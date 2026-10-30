"use client";
// 은은한 간접 조명. 품질 설정에 따라 조명 수와 그림자를 줄입니다.
import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ALTAR, CANDLE_RACK, CRUCIFIX, MARY, MARY_SHRINE, ROSE_ALTAR, SANCTUARY_Y } from "@/lib/game/chapelLayout";
import type { Quality } from "@/store/useAppStore";
import { hourOverride, koreaHour, moodAt, type LightMood } from "@/lib/timeOfDay";

/** 한국 시각에 맞춘 조명. 1분마다 다시 계산 (주소 ?hour=21 이면 그 시각으로 고정) */
function useMood(): LightMood {
  const read = () => moodAt(hourOverride(typeof window === "undefined" ? "" : window.location.search) ?? koreaHour());
  const [mood, setMood] = useState(read);
  useEffect(() => {
    const id = setInterval(() => setMood(read()), 60_000);
    return () => clearInterval(id);
  }, []);
  return mood;
}

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
function LightShafts({ opacity }: { opacity: number }) {
  const zs = [-12.5, -7.5, -2.5, 2.5, 7.5];
  return (
    <group>
      {zs.map((z) => (
        <mesh key={z} position={[-3.2, 7.5, z + 1.5]} rotation={[0.35, 0, -0.6]}>
          <planeGeometry args={[1.4, 14]} />
          <meshBasicMaterial color="#fff0cc" transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

export function Lighting({ quality }: { quality: Quality }) {
  const spot = useRef<THREE.SpotLight>(null);
  const fill = useRef<THREE.SpotLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const marySpot = useRef<THREE.SpotLight>(null);
  const high = quality === "high";
  const low = quality === "low";
  const mood = useMood();
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMappingExposure = mood.exposure;
  }, [gl, mood.exposure]);

  useEffect(() => {
    for (const l of [spot.current, fill.current]) {
      if (!l) continue;
      l.target.position.set(CRUCIFIX.x, CRUCIFIX.focusY, CRUCIFIX.z);
      l.target.updateMatrixWorld();
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
      {/* 시간에 따라: 낮은 화사한 크림빛, 노을은 주황빛, 밤은 어둑하고 촛불이 은은함 (lib/timeOfDay.ts) */}
      <color attach="background" args={[mood.background]} />
      <fog attach="fog" args={[mood.fog, 26, 75]} />
      {/* 사방에서 고르게 오는 빛. 너무 세면 조각상이 납작해지므로 십자가상 조명(아래)과 균형을 맞춤.
          휴대폰 낮은 품질은 그림자·보조광이 없어 조금 더 밝게 */}
      <hemisphereLight args={[mood.sky, mood.ground, mood.hemi * (low ? 1.2 : 1)]} />
      <ambientLight intensity={mood.ambient * (low ? 1.3 : 1)} color="#fff1dc" />

      {/* 왼쪽 창으로 들어오는 햇빛 (밤에는 푸르스름한 달빛) */}
      <directionalLight
        ref={sun}
        position={[-14, 16, 4]}
        intensity={mood.sun * (high ? 1.25 : 1)}
        color={mood.sunColor}
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

      {/*
        십자가상 주 조명: 정면에서 비추면 근육·옷 주름에 그늘이 생기지 않아 평면처럼 보이므로
        앞 오른쪽 위에서 비스듬히(약 45°) 비춥니다.
      */}
      <spotLight
        ref={spot}
        position={[CRUCIFIX.x + 6, 10.5, CRUCIFIX.z + 6.4]}
        angle={0.34}
        penumbra={0.7}
        intensity={low ? 260 : 300}
        distance={30}
        decay={1.6}
        color="#fff0d6"
        castShadow={high}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
      {/* 반대쪽 그늘이 새까매지지 않게 하는 약하고 푸른 보조광 (휴대폰 낮은 품질에서는 생략) */}
      {!low && (
        <spotLight ref={fill} position={[CRUCIFIX.x - 6, 6, CRUCIFIX.z + 5.4]} angle={0.34} penumbra={0.8} intensity={45} distance={30} decay={1.6} color="#cfd8ff" />
      )}

      {/* 제단 촛불 */}
      <FlickerLight position={[ALTAR.x, SANCTUARY_Y + 2, ALTAR.z + 0.6]} base={(low ? 3 : 4) * mood.candles} color="#ffc27a" distance={9} />
      {!low && (
        <>
          {/* 장미 제단 촛불 */}
          <FlickerLight position={[ROSE_ALTAR.x - 0.9, 1.5, ROSE_ALTAR.z]} base={2.2 * mood.candles} color="#ffb48a" distance={5} />
          {/* 성모상과 봉헌 초 */}
          <FlickerLight position={[CANDLE_RACK.x + 0.8, 1.4, CANDLE_RACK.z]} base={2.4 * mood.candles} color="#ffb766" distance={6} />
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
      {!low && <LightShafts opacity={mood.shafts} />}
    </>
  );
}
