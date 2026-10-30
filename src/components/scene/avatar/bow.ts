// 절(인사) 동작: 정해진 시각부터 BOW_MS 동안 숙였다 일어남. 애니메이션 클립과 별개로
// '절하기 축(BowPivot)' 그룹만 돌리므로 Idle/Walk 클립 위에 겹쳐 적용됩니다.
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { BOW_MS } from "@/lib/game/PlayerState";
import { crossHandOffset } from "@/lib/game/gestures";

export interface BowState {
  at: number;
}

export function bowAmount(at: number, now: number): number {
  const e = (now - at) / 1000;
  if (at <= 0 || e < 0 || e > BOW_MS / 1000) return 0;
  const ease = (x: number) => x * x * (3 - 2 * x);
  if (e < 0.7) return ease(e / 0.7);
  if (e < 2.0) return 1;
  return 1 - ease((e - 2.0) / 0.8);
}

/** 그룹을 앞으로 숙임 (앞 = -Z, x축 음의 회전) */
export function useBow(group: RefObject<THREE.Group | null>, bow: BowState | undefined, maxAngle: number) {
  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.x = -maxAngle * (bow ? bowAmount(bow.at, Date.now()) : 0);
  });
}

/** 성호 긋는 오른손. 머리 중심(headCenter, 부모 그룹 기준)에서 crossHandOffset 만큼 떨어진 곳에 잠깐 나타남 */
export function useCrossHand(hand: RefObject<THREE.Object3D | null>, cross: BowState | undefined, headCenter: readonly [number, number, number]) {
  useFrame(() => {
    const h = hand.current;
    if (!h) return;
    const off = cross ? crossHandOffset(cross.at, Date.now()) : null;
    h.visible = off !== null;
    if (off) h.position.set(headCenter[0] + off[0], headCenter[1] + off[1], headCenter[2] + off[2]);
  });
}
