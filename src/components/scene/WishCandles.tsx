"use client";
// 초 제단(소원 초): 3단 계단식 제단 위에 하루 동안 켜 둔 소원 초를 색색의 유리 촛잔으로 보여 줍니다.
// 빈 자리는 불 꺼진 맑은 촛잔. 촛잔·불꽃을 각각 InstancedMesh 하나로 그려 48개여도 그리기 호출은 몇 번뿐입니다.
import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CANDLE_RACK } from "@/lib/game/chapelLayout";
import { candleSlot, tierTop, tierX, WISH_COLORS, WISH_SLOTS } from "@/lib/wishes";
import { getNetworkManager } from "@/lib/net/NetworkManager";

const CUP_H = 0.11;
const EMPTY = new THREE.Color("#9a948a");

export function WishCandles() {
  const store = getNetworkManager().wishes;
  const version = useSyncExternalStore(
    (fn) => store.subscribe(fn),
    () => store.version,
    () => 0,
  );
  const cups = useRef<THREE.InstancedMesh>(null);
  const flames = useRef<THREE.InstancedMesh>(null);
  const lit = useRef(0);
  const slots = useMemo(() => Array.from({ length: WISH_SLOTS }, (_, i) => candleSlot(i)), []);
  const cupGeo = useMemo(() => new THREE.CylinderGeometry(0.034, 0.028, CUP_H, 10).translate(0, CUP_H / 2, 0), []);
  const flameGeo = useMemo(() => new THREE.ConeGeometry(0.018, 0.07, 6).translate(0, 0.035, 0), []);

  // 초 색깔·자리 기록 (목록이 바뀔 때만)
  useLayoutEffect(() => {
    const c = cups.current;
    if (!c) return;
    const wishes = store.all().slice(0, WISH_SLOTS);
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    slots.forEach((s, i) => {
      o.position.set(s.x, s.y, s.z);
      o.updateMatrix();
      c.setMatrixAt(i, o.matrix);
      const w = wishes[i];
      c.setColorAt(i, w ? col.set(WISH_COLORS[w.color] ?? WISH_COLORS[0]) : EMPTY);
    });
    c.instanceMatrix.needsUpdate = true;
    if (c.instanceColor) c.instanceColor.needsUpdate = true;
    lit.current = wishes.length;
  }, [version, store, slots]);

  // 불꽃: 켜진 초 위에서만, 저마다 조금씩 다르게 흔들림
  useFrame(({ clock }) => {
    const f = flames.current;
    if (!f) return;
    const t = clock.elapsedTime * 3;
    const o = tmpObj;
    for (let i = 0; i < lit.current; i++) {
      const s = slots[i];
      const k = 1 + Math.sin(t + i * 1.7) * 0.08 + Math.sin(t * 2.3 + i) * 0.05;
      o.position.set(s.x, s.y + CUP_H - 0.01, s.z);
      o.scale.set(1, k, 1);
      o.updateMatrix();
      f.setMatrixAt(i, o.matrix);
    }
    f.count = lit.current;
    f.instanceMatrix.needsUpdate = true;
  });

  const tiers = Array.from({ length: CANDLE_RACK.tiers }, (_, t) => t);
  const step = CANDLE_RACK.depth / CANDLE_RACK.tiers;
  return (
    <group>
      {/* 계단식 제단: 앞단이 낮고 벽 쪽이 높음 */}
      {tiers.map((t) => (
        <mesh key={t} position={[tierX(t), tierTop(t) / 2, CANDLE_RACK.z]} castShadow receiveShadow>
          <boxGeometry args={[step + 0.01, tierTop(t), CANDLE_RACK.width]} />
          <meshStandardMaterial color={t % 2 ? "#4a2e1b" : "#553521"} roughness={0.8} />
        </mesh>
      ))}
      {/* 단마다 금속 받침판 */}
      {tiers.map((t) => (
        <mesh key={`p${t}`} position={[tierX(t), tierTop(t) + 0.005, CANDLE_RACK.z]}>
          <boxGeometry args={[step - 0.02, 0.01, CANDLE_RACK.width - 0.04]} />
          <meshStandardMaterial color="#3a3530" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
      <instancedMesh ref={cups} args={[cupGeo, undefined, WISH_SLOTS]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.35} transparent opacity={0.88} />
      </instancedMesh>
      <instancedMesh ref={flames} args={[flameGeo, undefined, WISH_SLOTS]} frustumCulled={false}>
        <meshBasicMaterial color="#ffd27a" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

const tmpObj = new THREE.Object3D();
