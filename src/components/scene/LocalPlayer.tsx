"use client";
// 로컬 플레이어: 입력 → stepPlayer → 아바타 위치 반영 → 근처 상호작용 확인 → 네트워크 전송 판단
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { stepPlayer } from "@/lib/game/PlayerController";
import { findInteraction } from "@/lib/game/InteractionSystem";
import { getNetworkManager } from "@/lib/net/NetworkManager";
import { isBowing, isNearJesus, isNearMary, localPlayer, occupiedSeats } from "@/store/localPlayer";
import { useApp } from "@/store/useAppStore";
import { Avatar } from "./Avatar";
import { sceneRefs } from "./sceneRefs";
import { deriveAnimState } from "@/lib/game/avatarConfig";

const getLocalAnim = () => deriveAnimState(localPlayer.state);

export function LocalPlayer() {
  const ref = useRef<THREE.Group>(null);
  const pose = useApp((s) => s.pose);
  const nickname = useApp((s) => s.nickname);
  const lastPromptCheck = useRef(0);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const app = useApp.getState();
    // 입장 화면에서는 아바타 없이 성당만 보여 줌
    if (app.phase !== "chapel") {
      if (ref.current) ref.current.visible = false;
      return;
    }
    // 기도 패널이 열려 있거나 절하는 동안에는 이동하지 않음
    const blocked = app.panel !== null || isBowing();
    const input = blocked
      ? { forward: 0, right: 0 }
      : {
          forward: localPlayer.keys.forward + localPlayer.touch.forward,
          right: localPlayer.keys.right + localPlayer.touch.right,
          run: localPlayer.run.key || localPlayer.run.touch,
        };
    localPlayer.state = stepPlayer(localPlayer.state, input, localPlayer.camera.yaw, dt);
    const s = localPlayer.state;

    if (ref.current) {
      // 걸음에 따른 오르내림은 애니메이션 클립(Walk/Run)이 담당
      ref.current.position.set(s.x, s.y, s.z);
      ref.current.rotation.y = s.yaw;
      // 묵상 시점이거나, 벽·기둥 때문에 카메라가 머리에 바짝 붙으면 내 아바타를 숨김
      const cam = state.camera.position;
      const tooClose = Math.hypot(cam.x - s.x, cam.y - (s.y + 1.4), cam.z - s.z) < 0.5;
      ref.current.visible = !(app.meditation && s.pose === "sit") && !tooClose;
    }

    // 상호작용 대상 확인은 10Hz면 충분
    const now = state.clock.elapsedTime;
    if (now - lastPromptCheck.current > 0.1) {
      lastPromptCheck.current = now;
      app.setPrompt(s.pose === "sit" ? null : findInteraction(s.x, s.z, occupiedSeats()));
      app.setNearMary(s.pose === "stand" && isNearMary(s.x, s.z));
      app.setNearJesus(s.pose === "stand" && isNearJesus(s.x, s.z));
    }

    getNetworkManager().updateLocal(s);
  });

  // 개발 서버에서만: 브라우저 콘솔/자동 테스트에서 이동·애니메이션 상태 확인
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as { __chapelDebug?: unknown };
    w.__chapelDebug = {
      state: () => ({ ...localPlayer.state }),
      camera: () => sceneRefs.camera?.position.toArray(),
      cameraObject: () => sceneRefs.camera,
      setCamera: (yaw: number, pitch: number, distance: number) => Object.assign(localPlayer.camera, { yaw, pitch, distance }),
      teleport: (x: number, z: number) => void (localPlayer.state = { ...localPlayer.state, x, z }),
      /** 조명·재질을 콘솔에서 살펴보기 위한 장면 루트 */
      scene: () => {
        let o: THREE.Object3D | null | undefined = ref.current;
        while (o?.parent) o = o.parent;
        return o;
      },
      anim: () => {
        let s: unknown = null;
        ref.current?.traverse((o) => (s ??= o.userData.animState ?? null));
        return s;
      },
    };
    return () => void delete w.__chapelDebug;
  }, []);

  return <Avatar ref={ref} color="#8b7d6b" pose={pose} bow={localPlayer.bow} getAnim={getLocalAnim} label={nickname} showLabel={false} />;
}
