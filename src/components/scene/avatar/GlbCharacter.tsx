"use client";
// GLB 캐릭터 (예: Wands King Bride). AVATAR_MODEL.url 이 있을 때만 쓰입니다.
// 같은 모델을 여러 명이 쓰므로 뼈대까지 복제(SkeletonUtils.clone)하고, 키를 heightM 에 맞춥니다.
// 클립 이름은 AVATAR_MODEL.clips 로 연결하고, 없는 클립은 AvatarAnimator 가 대체 상태로 재생합니다.
import { useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { ANIM_STATES, AVATAR_MODEL, type AnimState } from "@/lib/game/avatarConfig";
import { AvatarAnimator, type AnimClips } from "./AvatarAnimator";
import { useAnimationDriver } from "./useAnimationDriver";
import { useBow } from "./bow";
import type { CharacterProps } from "./PlaceholderCharacter";

function findClip(all: THREE.AnimationClip[], name: string | undefined) {
  if (!name) return undefined;
  const n = name.toLowerCase();
  return all.find((c) => c.name.toLowerCase() === n) ?? all.find((c) => c.name.toLowerCase().includes(n));
}

export function GlbCharacter({ url, bow, getAnim }: CharacterProps & { url: string }) {
  const gltf = useGLTF(url);
  const { model, scale, clips } = useMemo(() => {
    const model = cloneSkinned(gltf.scene);
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        // 화면 밖 판정이 뼈 움직임을 못 따라가 사라지는 문제 방지
        o.frustumCulled = false;
      }
    });
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const scale = size.y > 0 ? AVATAR_MODEL.heightM / size.y : 1;
    const clips: AnimClips = {};
    for (const s of ANIM_STATES) {
      const c = findClip(gltf.animations, AVATAR_MODEL.clips[s]);
      if (c) clips[s as AnimState] = c;
    }
    return { model, scale, clips };
  }, [gltf]);

  const root = useRef<THREE.Group>(null);
  const bowPivot = useRef<THREE.Group>(null);
  const animator = useRef<AvatarAnimator | null>(null);
  // 모델에 Bow 클립이 없을 때는 몸 전체를 엉덩이 높이에서 살짝 숙임
  useBow(bowPivot, bow, 0.5);
  useAnimationDriver(root, animator, getAnim);
  const hipY = AVATAR_MODEL.heightM * 0.5;

  return (
    <group
      ref={(g) => {
        root.current = g;
        if (g && !animator.current) animator.current = new AvatarAnimator(model, clips, AVATAR_MODEL.fadeSec);
      }}
    >
      <group position={[0, hipY, 0]}>
        <group ref={bowPivot}>
          <group position={[0, -hipY + AVATAR_MODEL.yOffset, 0]} rotation={[0, AVATAR_MODEL.rotationY, 0]} scale={scale}>
            <primitive object={model} />
          </group>
        </group>
      </group>
    </group>
  );
}
