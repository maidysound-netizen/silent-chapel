"use client";
// Meshy AI 로 만든 성상 GLB (십자가상·성모상)를 불러와 크기·바닥 높이를 맞춰 세웁니다.
// 원본(object/ 폴더, 40~56MB)은 그대로 두고, 웹용으로 줄인 사본(public/models/chapel/*.glb, 1MB 이하)을 씁니다.
// 불러오는 중이거나 실패하면 fallback(기존 단순 모형)을 보여 주므로 화면이 비지 않습니다.
import { Component, Suspense, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export interface StatueProps {
  url: string;
  /** 받침 밑면이 놓일 위치 (월드 좌표) */
  position: [number, number, number];
  /** 바닥(받침 밑면)부터 꼭대기까지 높이(m). 모델 크기와 상관없이 이 높이로 맞춤 */
  height: number;
  /** 모델 정면 보정 (Meshy 모델은 +Z 가 정면) */
  rotationY?: number;
  /**
   * Meshy 재질은 metallic=1 이라 반사할 환경맵이 없는 어두운 성당에서 검게 보입니다.
   * 돌·석고 조각상처럼 보이도록 금속성 상한을 낮춥니다.
   */
  maxMetalness?: number;
  fallback: ReactNode;
}

class StatueBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("[statue] GLB 모델을 불러오지 못해 기본 모형을 씁니다:", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function LoadedStatue({ url, position, height, rotationY = 0, maxMetalness = 0.15 }: Omit<StatueProps, "fallback">) {
  const gltf = useGLTF(url);
  const { object, scale, offset } = useMemo(() => {
    const object = gltf.scene.clone(true);
    object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (!Array.isArray(m) && m.isMeshStandardMaterial) {
        const std = m.clone();
        std.metalness = Math.min(std.metalness, maxMetalness);
        // 닫힌 조각상이라 안쪽 면은 보이지 않음 → 앞면만 그려 모바일 부담을 줄임
        std.side = THREE.FrontSide;
        mesh.material = std;
      }
    });
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = size.y > 0 ? height / size.y : 1;
    // 가로 중심을 원점으로, 밑면을 바닥(y=0)으로
    const offset = new THREE.Vector3(-center.x, -box.min.y, -center.z);
    return { object, scale, offset };
  }, [gltf, height, maxMetalness]);

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={object} position={offset} />
    </group>
  );
}

export function StatueModel({ fallback, ...props }: StatueProps) {
  return (
    <StatueBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LoadedStatue {...props} />
      </Suspense>
    </StatueBoundary>
  );
}

export const STATUE_URLS = {
  crucifix: "/models/chapel/crucifix.glb",
  mary: "/models/chapel/mary.glb",
} as const;

// 입장 화면 동안 미리 받아 둠
useGLTF.preload(STATUE_URLS.crucifix);
useGLTF.preload(STATUE_URLS.mary);
