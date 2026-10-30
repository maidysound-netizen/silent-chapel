"use client";
// 다른 방문자 아바타. 위치는 SnapshotBuffer 보간 결과를 매 프레임 적용합니다.
import { useCallback, useRef, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getNetworkManager } from "@/lib/net/NetworkManager";
import { useApp } from "@/store/useAppStore";
import { Avatar } from "./Avatar";
import type { AnimState } from "@/lib/game/avatarConfig";

const PALETTE = ["#6f7f8f", "#7d6f8f", "#6f8f7a", "#8f846f", "#8f6f6f", "#6f868f", "#7f8f6f", "#8f7a6f"];

function colorFor(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function RemoteAvatar({ uid, label, pose }: { uid: string; label: string; pose: "stand" | "sit" }) {
  const ref = useRef<THREE.Group>(null);
  const showNames = useApp((s) => s.settings.showNames);
  useFrame(() => {
    const net = getNetworkManager();
    const r = net.remotes.get(uid);
    if (!r || !ref.current) return;
    const sample = r.buffer.sample(Date.now() - net.interpolationDelay);
    ref.current.visible = sample !== null;
    if (!sample) return;
    ref.current.position.set(sample.x, sample.y, sample.z);
    ref.current.rotation.y = sample.yaw;
  });
  const bow = getNetworkManager().remotes.get(uid)?.bow;
  const cross = getNetworkManager().remotes.get(uid)?.cross;
  // 받은 애니메이션 상태(idle/walk/run/sit…)를 매 프레임 읽음
  const getAnim = useCallback((): AnimState => getNetworkManager().remotes.get(uid)?.anim ?? (pose === "sit" ? "sit" : "idle"), [uid, pose]);
  const getHoldingRose = useCallback(() => getNetworkManager().remotes.get(uid)?.holdingRose ?? false, [uid]);
  return (
    <Avatar
      ref={ref}
      color={colorFor(uid)}
      pose={pose}
      bow={bow}
      cross={cross}
      getHoldingRose={getHoldingRose}
      getAnim={getAnim}
      label={label}
      showLabel={showNames}
    />
  );
}

export function RemoteAvatars() {
  const net = getNetworkManager();
  const snap = useSyncExternalStore(net.subscribe.bind(net), net.getSnapshot, net.getSnapshot);
  return (
    <>
      {snap.others.map((o) => (
        <RemoteAvatar key={o.uid} uid={o.uid} label={`${o.nick} #${o.tag}`} pose={o.pose} />
      ))}
    </>
  );
}
