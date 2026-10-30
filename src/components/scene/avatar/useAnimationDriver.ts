// 매 프레임: 아바타가 실제로 움직인 속도를 재고 → 애니메이션 상태를 고르고 → 믹서를 돌립니다.
// 로컬·원격·임시 캐릭터·GLB 모두 같은 방식이라, 상태 출처(getAnim)만 다릅니다.
import { useEffect, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AVATAR_MODEL, type AnimState } from "@/lib/game/avatarConfig";
import type { AvatarAnimator } from "./AvatarAnimator";

const tmp = new THREE.Vector3();

export function useAnimationDriver(
  root: RefObject<THREE.Object3D | null>,
  animator: RefObject<AvatarAnimator | null>,
  getAnim: () => AnimState,
) {
  const last = useRef<{ x: number; z: number } | null>(null);
  const speed = useRef(0);
  const get = useRef(getAnim);
  get.current = getAnim;

  useEffect(() => () => animator.current?.dispose(), [animator]);

  useFrame((_, delta) => {
    const a = animator.current;
    const g = root.current;
    if (!a || !g) return;
    const dt = Math.min(delta, 0.1);
    g.getWorldPosition(tmp);
    if (last.current && dt > 0) {
      const v = Math.min(8, Math.hypot(tmp.x - last.current.x, tmp.z - last.current.z) / dt);
      speed.current += (v - speed.current) * Math.min(1, dt * 8);
    }
    last.current = { x: tmp.x, z: tmp.z };
    const s = a.setState(get.current());
    g.userData.animState = s; // 개발 중 확인용 (화면에는 영향 없음)
    if (s === "walk" || s === "run") a.setTimeScale(THREE.MathUtils.clamp(speed.current / AVATAR_MODEL.clipSpeed[s], 0.6, 1.6));
    a.update(dt);
  });
}
