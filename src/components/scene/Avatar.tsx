"use client";
// 방문자 아바타. 모델(임시 캐릭터 또는 GLB)과 이름표를 묶고, 위치·회전은 바깥 group(ref)으로 받습니다.
// 모델 선택은 AVATAR_MODEL.url 하나로 결정됩니다:
//   null → PlaceholderCharacter (코드로 만든 실루엣),  "/models/….glb" → GlbCharacter
// GLB를 불러오는 중이거나 실패하면 임시 캐릭터를 보여 주므로 화면이 비지 않습니다.
import { Component, forwardRef, Suspense, type ReactNode } from "react";
import type * as THREE from "three";
import { AVATAR_MODEL, type AnimState } from "@/lib/game/avatarConfig";
import type { Pose } from "@/lib/game/PlayerState";
import { TextSprite } from "./TextSprite";
import { PlaceholderCharacter } from "./avatar/PlaceholderCharacter";
import { GlbCharacter } from "./avatar/GlbCharacter";
import type { BowState } from "./avatar/bow";

export type { BowState } from "./avatar/bow";

export interface AvatarProps {
  color: string;
  pose: Pose;
  /** 절 동작 시작 시각 (가변 객체: 매 프레임 읽음) */
  bow?: BowState;
  /** 지금 애니메이션 상태 (매 프레임 읽음). 로컬은 내 이동 상태, 원격은 받은 상태 */
  getAnim: () => AnimState;
  label?: string;
  showLabel?: boolean;
}

/** GLB 로딩 실패 시 임시 캐릭터로 */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("[avatar] GLB 모델을 불러오지 못해 임시 캐릭터를 씁니다:", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export const Avatar = forwardRef<THREE.Group, AvatarProps>(function Avatar({ color, pose, bow, getAnim, label, showLabel }, ref) {
  const sit = pose === "sit";
  const placeholder = <PlaceholderCharacter color={color} pose={pose} bow={bow} getAnim={getAnim} />;
  const url = AVATAR_MODEL.url;
  return (
    <group ref={ref}>
      {url ? (
        <ModelBoundary fallback={placeholder}>
          <Suspense fallback={placeholder}>
            <GlbCharacter url={url} color={color} pose={pose} bow={bow} getAnim={getAnim} />
          </Suspense>
        </ModelBoundary>
      ) : (
        placeholder
      )}
      {label && showLabel && <TextSprite text={label} position={[0, sit ? 1.6 : 1.85, 0]} height={0.3} />}
    </group>
  );
});
