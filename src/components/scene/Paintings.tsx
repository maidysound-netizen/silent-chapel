"use client";
// 벽에 거는 성화. 그림 파일(public/art/*.jpg)을 금빛 액자에 넣어 걸어 둡니다.
// 그림을 추가하려면 PAINTINGS 에 한 줄만 더하면 됩니다. 불러오는 동안·실패하면 액자만 보입니다.
import { Component, Suspense, type ReactNode } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { APSE_Z, SANCTUARY_Y } from "@/lib/game/chapelLayout";

export interface PaintingDef {
  url: string;
  /** 그림 가운데 위치와 벽 방향(그림 정면이 바라보는 쪽, Y축 회전) */
  position: [number, number, number];
  rotationY: number;
  /** 그림 크기(m, 액자 제외) */
  width: number;
  height: number;
}

export const PAINTINGS: PaintingDef[] = [
  // 성모 영보 — 제단 뒤 벽, 십자가상 왼쪽(성모 기도 공간 쪽)
  { url: "/art/annunciation.jpg", position: [-4.8, SANCTUARY_Y + 3.75, APSE_Z + 0.06], rotationY: 0, width: 2.4, height: 3.6 },
];

const FRAME = 0.14;
const GOLD = "#c9a44a";

function Frame({ width, height }: { width: number; height: number }) {
  const bars: [number, number, number, number][] = [
    [0, height / 2 + FRAME / 2, width + FRAME * 2, FRAME],
    [0, -height / 2 - FRAME / 2, width + FRAME * 2, FRAME],
    [-width / 2 - FRAME / 2, 0, FRAME, height],
    [width / 2 + FRAME / 2, 0, FRAME, height],
  ];
  return (
    <group>
      {bars.map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.03]} castShadow>
          <boxGeometry args={[w, h, 0.08]} />
          <meshStandardMaterial color={GOLD} metalness={0.65} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function Canvas({ url, width, height }: { url: string; width: number; height: number }) {
  const tex = useTexture(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return (
    <mesh position={[0, 0, 0.015]}>
      <planeGeometry args={[width, height]} />
      {/* 유화 느낌: 반사가 거의 없는 무광 */}
      <meshStandardMaterial map={tex} roughness={0.85} metalness={0} />
    </mesh>
  );
}

class PaintingBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function Paintings() {
  return (
    <group>
      {PAINTINGS.map((p) => (
        <group key={p.url} position={p.position} rotation={[0, p.rotationY, 0]}>
          <Frame width={p.width} height={p.height} />
          <PaintingBoundary>
            <Suspense fallback={null}>
              <Canvas url={p.url} width={p.width} height={p.height} />
            </Suspense>
          </PaintingBoundary>
        </group>
      ))}
    </group>
  );
}
