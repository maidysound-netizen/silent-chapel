"use client";
// 로컬 플레이어: 입력 → stepPlayer → 아바타 위치 반영 → 근처 상호작용 확인 → 네트워크 전송 판단
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { stepPlayer } from "@/lib/game/PlayerController";
import { findInteraction } from "@/lib/game/InteractionSystem";
import { getNetworkManager } from "@/lib/net/NetworkManager";
import { localPlayer, occupiedSeats } from "@/store/localPlayer";
import { useApp } from "@/store/useAppStore";
import { Avatar } from "./Avatar";

export function LocalPlayer() {
  const ref = useRef<THREE.Group>(null);
  const pose = useApp((s) => s.pose);
  const nickname = useApp((s) => s.nickname);
  const lastPromptCheck = useRef(0);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const app = useApp.getState();
    const blocked = app.panel !== null; // 기도/성경 패널이 열려 있으면 이동하지 않음
    const input = blocked
      ? { forward: 0, right: 0 }
      : {
          forward: localPlayer.keys.forward + localPlayer.touch.forward,
          right: localPlayer.keys.right + localPlayer.touch.right,
        };
    localPlayer.state = stepPlayer(localPlayer.state, input, localPlayer.camera.yaw, dt);
    const s = localPlayer.state;

    if (ref.current) {
      ref.current.position.set(s.x, s.y + (s.moving ? Math.abs(Math.sin(state.clock.elapsedTime * 7)) * 0.03 : 0), s.z);
      ref.current.rotation.y = s.yaw;
      // 묵상 시점에서는 카메라가 내 눈 위치에 있으므로 내 아바타를 숨김
      ref.current.visible = !(app.meditation && s.pose === "sit");
    }

    // 상호작용 대상 확인은 10Hz면 충분
    const now = state.clock.elapsedTime;
    if (now - lastPromptCheck.current > 0.1) {
      lastPromptCheck.current = now;
      app.setPrompt(s.pose === "sit" ? null : findInteraction(s.x, s.z, occupiedSeats()));
    }

    getNetworkManager().updateLocal(s);
  });

  return <Avatar ref={ref} color="#8b7d6b" pose={pose} label={nickname} showLabel={false} />;
}
