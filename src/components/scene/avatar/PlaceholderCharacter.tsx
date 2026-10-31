"use client";
// 임시 캐릭터: 단순하고 중립적인 방문자 실루엣 (긴 옷). 얼굴/성별/종교 복장을 표현하지 않습니다.
// 서 있을 때는 AnimationMixer 로 Idle/Walk/Run 클립을 재생하고, 앉은 자세는 별도 모양을 씁니다.
// GLB 모델(GlbCharacter)과 같은 props 를 받으므로 Avatar 에서 둘 중 하나로 바꿔 끼울 수 있습니다.
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { AnimState } from "@/lib/game/avatarConfig";
import { AVATAR_MODEL } from "@/lib/game/avatarConfig";
import type { Pose } from "@/lib/game/PlayerState";
import { AvatarAnimator } from "./AvatarAnimator";
import { placeholderClips } from "./placeholderClips";
import { useAnimationDriver } from "./useAnimationDriver";
import { useBow, useCrossHand, type BowState } from "./bow";
import { HeldRose } from "../Roses";

export interface CharacterProps {
  color: string;
  pose: Pose;
  /** 절 동작 시작 시각 (가변 객체: 매 프레임 읽음) */
  bow?: BowState;
  /** 성호 긋기 시작 시각 (가변 객체) */
  cross?: BowState;
  /** 장미를 들고 있는지 (매 프레임 읽음) */
  getHeldFlower?: () => number | null;
  /** 지금 재생할 애니메이션 상태 (매 프레임 읽음) */
  getAnim: () => AnimState;
}

/** 허리(0.85m)를 기준으로 아래 옷자락과 윗몸을 나눠서, 윗몸만 숙일 수 있게 함 */
const WAIST_Y = 0.85;
const SKIN = "#d8c8b0";

function lathe(points: number[][]) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), 16);
}
let robeLower: THREE.LatheGeometry | null = null;
let robeUpper: THREE.LatheGeometry | null = null;
let torsoG: THREE.LatheGeometry | null = null;
const robeGeos = () => {
  robeLower ??= lathe([[0, 0], [0.26, 0], [0.24, 0.3], [0.205, WAIST_Y], [0, WAIST_Y]]);
  robeUpper ??= lathe([[0, 0], [0.205, 0], [0.2, 0.3], [0.15, 0.45], [0.07, 0.51], [0, 0.52]]);
  return { lower: robeLower, upper: robeUpper };
};
// 앉은 자세 상체 (엉덩이 높이에서 목까지)
const torsoGeo = () => (torsoG ??= lathe([[0, 0], [0.18, 0], [0.17, 0.25], [0.16, 0.45], [0.12, 0.58], [0.06, 0.64], [0, 0.65]]));

/**
 * 앉은 자세: 장의자 좌판(높이 0.49m) 위에 엉덩이, 허벅지는 앞으로, 종아리는 아래로.
 * 등은 등받이 앞(로컬 +Z 0.15 이내)에 오도록 해서 장의자를 뚫지 않게 합니다.
 */
/** 성호 긋는 오른손 (평소에는 숨김) */
function CrossHand({ handRef }: { handRef: RefObject<THREE.Mesh | null> }) {
  return (
    <mesh ref={handRef} visible={false} rotation={[Math.PI / 2, 0, 0]}>
      <capsuleGeometry args={[0.04, 0.07, 4, 8]} />
      <meshStandardMaterial color={SKIN} roughness={0.8} />
    </mesh>
  );
}

function SeatedBody({ color, bow, cross, getHeldFlower }: { color: string; bow?: BowState; cross?: BowState; getHeldFlower?: () => number | null }) {
  const torso = useMemo(() => torsoGeo(), []);
  const upper = useRef<THREE.Group>(null);
  const hand = useRef<THREE.Mesh>(null);
  useBow(upper, bow, 0.45);
  useCrossHand(hand, cross, [0, 0.78, -0.03]);
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
        <CrossHand handRef={hand} />
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
      <HeldRose position={[0.03, 0.49 + 0.12, -0.34]} getHeldFlower={getHeldFlower} />
      {/* 무릎 위에 모은 손 */}
      <mesh position={[0, hipY + 0.16, -0.3]} rotation={[Math.PI / 2, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.04, 0.12, 4, 8]} />
        <meshStandardMaterial color={SKIN} roughness={0.8} />
      </mesh>
    </group>
  );
}

/**
 * 서 있는 몸. 애니메이션 대상 노드: Body / Hem / Upper / Head (placeholderClips.ts).
 * 절하기는 클립과 겹치지 않도록 Upper 바깥의 BowPivot 을 돌립니다.
 */
function StandingBody({
  color,
  bow,
  cross,
  getAnim,
  getHeldFlower,
}: {
  color: string;
  bow?: BowState;
  cross?: BowState;
  getAnim: () => AnimState;
  getHeldFlower?: () => number | null;
}) {
  const geos = useMemo(() => robeGeos(), []);
  const root = useRef<THREE.Group>(null);
  const bowPivot = useRef<THREE.Group>(null);
  const hand = useRef<THREE.Mesh>(null);
  // 머리 중심: Head 그룹(1.5 - 허리 - 0.1) + 구 중심 0.1
  useCrossHand(hand, cross, [0, 1.5 - WAIST_Y, 0]);
  const animator = useRef<AvatarAnimator | null>(null);
  useBow(bowPivot, bow, 0.75);
  useAnimationDriver(root, animator, getAnim);
  return (
    <group
      ref={(g) => {
        root.current = g;
        if (g && !animator.current) animator.current = new AvatarAnimator(g, placeholderClips(), AVATAR_MODEL.fadeSec);
      }}
    >
      <group name="Body">
        <mesh name="Hem" geometry={geos.lower} castShadow>
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
        {/* 허리를 축으로 숙이는 윗몸 (머리·모은 손 포함) */}
        <group ref={bowPivot} position={[0, WAIST_Y, 0]}>
          <group name="Upper">
            <mesh geometry={geos.upper} castShadow>
              <meshStandardMaterial color={color} roughness={0.85} />
            </mesh>
            <group name="Head" position={[0, 1.5 - WAIST_Y - 0.1, 0]}>
              <mesh position={[0, 0.1, 0]} castShadow>
                <sphereGeometry args={[0.13, 16, 12]} />
                <meshStandardMaterial color={SKIN} roughness={0.8} />
              </mesh>
            </group>
            {/* 가슴 앞에 모은 손 */}
            <mesh position={[0, 0.95 - WAIST_Y + 0.05, -0.2]} rotation={[0.6, 0, 0]}>
              <capsuleGeometry args={[0.04, 0.1, 4, 8]} />
              <meshStandardMaterial color={SKIN} roughness={0.8} />
            </mesh>
            <CrossHand handRef={hand} />
            {/* 모은 손에 든 장미 */}
            <HeldRose position={[0.03, 0.12, -0.25]} getHeldFlower={getHeldFlower} />
          </group>
        </group>
      </group>
    </group>
  );
}

/** kneel · pray 는 아직 임시 캐릭터 모양이 없어 서 있는 Idle 로 대신합니다 (GLB에 클립이 있으면 그걸 씀) */
export function PlaceholderCharacter({ color, pose, bow, cross, getAnim, getHeldFlower }: CharacterProps) {
  return pose === "sit" ? (
    <SeatedBody color={color} bow={bow} cross={cross} getHeldFlower={getHeldFlower} />
  ) : (
    <StandingBody color={color} bow={bow} cross={cross} getAnim={getAnim} getHeldFlower={getHeldFlower} />
  );
}
