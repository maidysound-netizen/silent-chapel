"use client";
// 단순하고 중립적인 방문자 아바타 (긴 옷을 입은 실루엣). 얼굴/성별/종교 복장을 표현하지 않습니다.
import { forwardRef, useMemo } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Pose } from "@/lib/game/PlayerState";

const robeGeo = (() => {
  let g: THREE.LatheGeometry | null = null;
  return () => {
    if (!g) {
      const pts = [
        [0.0, 0],
        [0.26, 0],
        [0.24, 0.3],
        [0.2, 0.8],
        [0.2, 1.15],
        [0.15, 1.3],
        [0.07, 1.36],
        [0.0, 1.37],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      g = new THREE.LatheGeometry(pts, 16);
    }
    return g;
  };
})();

export interface AvatarProps {
  color: string;
  pose: Pose;
  label?: string;
  showLabel?: boolean;
}

/** 위치·회전은 바깥 group(ref)으로 매 프레임 조정합니다 */
export const Avatar = forwardRef<THREE.Group, AvatarProps>(function Avatar({ color, pose, label, showLabel }, ref) {
  const geo = useMemo(() => robeGeo(), []);
  const sit = pose === "sit";
  return (
    <group ref={ref}>
      <group name="body" position={[0, sit ? -0.12 : 0, sit ? 0.08 : 0]} scale={[1, sit ? 0.85 : 1, 1]}>
        <mesh geometry={geo} castShadow>
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.5, 0]} castShadow>
          <sphereGeometry args={[0.13, 16, 12]} />
          <meshStandardMaterial color="#d8c8b0" roughness={0.8} />
        </mesh>
        {/* 앞쪽 표시(앞을 보는 방향을 알 수 있게 모은 손) */}
        <mesh position={[0, 0.95, -0.2]} rotation={[0.6, 0, 0]}>
          <capsuleGeometry args={[0.04, 0.1, 4, 8]} />
          <meshStandardMaterial color="#d8c8b0" roughness={0.8} />
        </mesh>
      </group>
      {label && showLabel && (
        <Html position={[0, sit ? 1.55 : 1.85, 0]} center distanceFactor={9} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="avatar-label">{label}</div>
        </Html>
      )}
    </group>
  );
});
