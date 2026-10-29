"use client";
// 단순하고 중립적인 방문자 아바타 (긴 옷을 입은 실루엣). 얼굴/성별/종교 복장을 표현하지 않습니다.
import { forwardRef, useEffect, useMemo } from "react";
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

/**
 * 이름표: 캔버스에 글자를 그려 스프라이트(항상 카메라를 보는 판)로 표시합니다.
 * (DOM 오버레이보다 가볍고, 한글도 시스템 글꼴로 그려집니다)
 */
function NameTag({ text, y }: { text: string; y: number }) {
  const { texture, aspect } = useMemo(() => {
    const scale = 2;
    const font = `${14 * scale}px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
    const c = document.createElement("canvas");
    const g = c.getContext("2d")!;
    g.font = font;
    const w = Math.ceil(g.measureText(text).width) + 20 * scale;
    const h = 24 * scale;
    c.width = w;
    c.height = h;
    g.font = font;
    g.fillStyle = "rgba(15,10,6,0.7)";
    g.beginPath();
    g.roundRect(0, 0, w, h, h / 2);
    g.fill();
    g.fillStyle = "#efe6d4";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + scale);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { texture: t, aspect: w / h };
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  const height = 0.3;
  return (
    <sprite position={[0, y, 0]} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

export interface AvatarProps {
  color: string;
  pose: Pose;
  label?: string;
  showLabel?: boolean;
}

// 앉은 자세 상체 (엉덩이 높이에서 목까지)
const torsoGeo = (() => {
  let g: THREE.LatheGeometry | null = null;
  return () => {
    if (!g) {
      const pts = [
        [0.0, 0],
        [0.18, 0],
        [0.17, 0.25],
        [0.16, 0.45],
        [0.12, 0.58],
        [0.06, 0.64],
        [0.0, 0.65],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      g = new THREE.LatheGeometry(pts, 16);
    }
    return g;
  };
})();

const SKIN = "#d8c8b0";

/**
 * 앉은 자세: 장의자 좌판(높이 0.49m) 위에 엉덩이, 허벅지는 앞으로, 종아리는 아래로.
 * 등은 등받이 앞(로컬 +Z 0.15 이내)에 오도록 해서 장의자를 뚫지 않게 합니다.
 */
function SeatedBody({ color }: { color: string }) {
  const torso = useMemo(() => torsoGeo(), []);
  const hipY = 0.49;
  return (
    <group name="body-sit">
      <mesh geometry={torso} position={[0, hipY, -0.03]} rotation={[-0.06, 0, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
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
      <mesh position={[0, hipY + 0.78, -0.06]} castShadow>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshStandardMaterial color={SKIN} roughness={0.8} />
      </mesh>
    </group>
  );
}

function StandingBody({ color }: { color: string }) {
  const geo = useMemo(() => robeGeo(), []);
  return (
    <group name="body">
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshStandardMaterial color={SKIN} roughness={0.8} />
      </mesh>
      {/* 앞쪽 표시(앞을 보는 방향을 알 수 있게 모은 손) */}
      <mesh position={[0, 0.95, -0.2]} rotation={[0.6, 0, 0]}>
        <capsuleGeometry args={[0.04, 0.1, 4, 8]} />
        <meshStandardMaterial color={SKIN} roughness={0.8} />
      </mesh>
    </group>
  );
}

/** 위치·회전은 바깥 group(ref)으로 매 프레임 조정합니다 */
export const Avatar = forwardRef<THREE.Group, AvatarProps>(function Avatar({ color, pose, label, showLabel }, ref) {
  const sit = pose === "sit";
  return (
    <group ref={ref}>
      {sit ? <SeatedBody color={color} /> : <StandingBody color={color} />}
      {label && showLabel && <NameTag text={label} y={sit ? 1.6 : 1.85} />}
    </group>
  );
});
