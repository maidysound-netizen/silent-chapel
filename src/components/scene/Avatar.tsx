"use client";
// 단순하고 중립적인 방문자 아바타 (긴 옷을 입은 실루엣). 얼굴/성별/종교 복장을 표현하지 않습니다.
import { forwardRef, useMemo, useRef } from "react";
import { TextSprite } from "./TextSprite";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BOW_MS, type Pose } from "@/lib/game/PlayerState";

/** 허리(0.85m)를 기준으로 아래 옷자락과 윗몸을 나눠서, 윗몸만 숙일 수 있게 함 */
const WAIST_Y = 0.85;
function lathe(points: number[][]) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), 16);
}
let robeLower: THREE.LatheGeometry | null = null;
let robeUpper: THREE.LatheGeometry | null = null;
const robeGeos = () => {
  robeLower ??= lathe([[0, 0], [0.26, 0], [0.24, 0.3], [0.205, WAIST_Y], [0, WAIST_Y]]);
  robeUpper ??= lathe([[0, 0], [0.205, 0], [0.2, 0.3], [0.15, 0.45], [0.07, 0.51], [0, 0.52]]);
  return { lower: robeLower, upper: robeUpper };
};

export interface BowState {
  at: number;
}
function bowAmount(at: number, now: number): number {
  const e = (now - at) / 1000;
  if (at <= 0 || e < 0 || e > BOW_MS / 1000) return 0;
  const ease = (x: number) => x * x * (3 - 2 * x);
  if (e < 0.7) return ease(e / 0.7);
  if (e < 2.0) return 1;
  return 1 - ease((e - 2.0) / 0.8);
}

/** 윗몸 그룹을 숙임 (앞 = -Z, x축 음의 회전) */
function useBow(group: React.RefObject<THREE.Group | null>, bow: BowState | undefined, maxAngle: number) {
  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.x = -maxAngle * (bow ? bowAmount(bow.at, Date.now()) : 0);
  });
}

/** 이름표 */
function NameTag({ text, y }: { text: string; y: number }) {
  return <TextSprite text={text} position={[0, y, 0]} height={0.3} />;
}

export interface AvatarProps {
  color: string;
  pose: Pose;
  /** 절 동작 시작 시각 (가변 객체: 매 프레임 읽음) */
  bow?: BowState;
  label?: string;
  showLabel?: boolean;
}

// 앉은 자세 상체 (엉덩이 높이에서 목까지)
let torsoG: THREE.LatheGeometry | null = null;
const torsoGeo = () => (torsoG ??= lathe([[0, 0], [0.18, 0], [0.17, 0.25], [0.16, 0.45], [0.12, 0.58], [0.06, 0.64], [0, 0.65]]));

const SKIN = "#d8c8b0";

/**
 * 앉은 자세: 장의자 좌판(높이 0.49m) 위에 엉덩이, 허벅지는 앞으로, 종아리는 아래로.
 * 등은 등받이 앞(로컬 +Z 0.15 이내)에 오도록 해서 장의자를 뚫지 않게 합니다.
 */
function SeatedBody({ color, bow }: { color: string; bow?: BowState }) {
  const torso = useMemo(() => torsoGeo(), []);
  const upper = useRef<THREE.Group>(null);
  useBow(upper, bow, 0.45);
  const hipY = 0.49;
  return (
    <group name="body-sit">
      {/* 엉덩이를 축으로 숙이는 윗몸 */}
      <group ref={upper} position={[0, hipY, -0.03]}>
        <mesh geometry={torso} rotation={[-0.06, 0, 0]} castShadow>
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.78, -0.03]} castShadow>
          <sphereGeometry args={[0.13, 16, 12]} />
          <meshStandardMaterial color={SKIN} roughness={0.8} />
        </mesh>
      </group>
      {/* 허벅지(옷자락) */}
      <mesh position={[0, hipY + 0.05, -0.24]} castShadow>
        <boxGeometry args={[0.34, 0.13, 0.44]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* 종아리 */}
      <mesh position={[0, hipY / 2, -0.4]} castShadow>
        <boxGeometry args={[0.3, hipY, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* 무릎 위에 모은 손 */}
      <mesh position={[0, hipY + 0.16, -0.3]} rotation={[Math.PI / 2, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.04, 0.12, 4, 8]} />
        <meshStandardMaterial color={SKIN} roughness={0.8} />
      </mesh>
    </group>
  );
}

function StandingBody({ color, bow }: { color: string; bow?: BowState }) {
  const geos = useMemo(() => robeGeos(), []);
  const upper = useRef<THREE.Group>(null);
  useBow(upper, bow, 0.75);
  return (
    <group name="body">
      <mesh geometry={geos.lower} castShadow>
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* 허리를 축으로 숙이는 윗몸 (머리·모은 손 포함) */}
      <group ref={upper} position={[0, WAIST_Y, 0]}>
        <mesh geometry={geos.upper} castShadow>
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.5 - WAIST_Y, 0]} castShadow>
          <sphereGeometry args={[0.13, 16, 12]} />
          <meshStandardMaterial color={SKIN} roughness={0.8} />
        </mesh>
        {/* 가슴 앞에 모은 손 */}
        <mesh position={[0, 0.95 - WAIST_Y + 0.05, -0.2]} rotation={[0.6, 0, 0]}>
          <capsuleGeometry args={[0.04, 0.1, 4, 8]} />
          <meshStandardMaterial color={SKIN} roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

/** 위치·회전은 바깥 group(ref)으로 매 프레임 조정합니다 */
export const Avatar = forwardRef<THREE.Group, AvatarProps>(function Avatar({ color, pose, bow, label, showLabel }, ref) {
  const sit = pose === "sit";
  return (
    <group ref={ref}>
      {sit ? <SeatedBody color={color} bow={bow} /> : <StandingBody color={color} bow={bow} />}
      {label && showLabel && <NameTag text={label} y={sit ? 1.6 : 1.85} />}
    </group>
  );
});
