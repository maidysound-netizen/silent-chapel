"use client";
// 다른 방문자 아바타. 위치는 SnapshotBuffer 보간 결과를 매 프레임 적용합니다.
import { useRef, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getNetworkManager } from "@/lib/net/NetworkManager";
import { useApp } from "@/store/useAppStore";
import { Avatar } from "./Avatar";

const PALETTE = ["#6f7f8f", "#7d6f8f", "#6f8f7a", "#8f846f", "#8f6f6f", "#6f868f", "#7f8f6f", "#8f7a6f"];

function colorFor(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function RemoteAvatar({ uid, label, pose }: { uid: string; label: string; pose: "stand" | "sit" }) {
  const ref = useRef<THREE.Group>(null);
  const showNames = useApp((s) => s.settings.showNames);
  useFrame(({ clock }) => {
    const net = getNetworkManager();
    const r = net.remotes.get(uid);
    if (!r || !ref.current) return;
    const sample = r.buffer.sample(Date.now() - net.interpolationDelay);
    ref.current.visible = sample !== null;
    if (!sample) return;
    const bob = r.moving ? Math.abs(Math.sin(clock.elapsedTime * 7 + uid.length)) * 0.03 : 0;
    ref.current.position.set(sample.x, sample.y + bob, sample.z);
    ref.current.rotation.y = sample.yaw;
  });
  return <Avatar ref={ref} color={colorFor(uid)} pose={pose} label={label} showLabel={showNames} />;
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
