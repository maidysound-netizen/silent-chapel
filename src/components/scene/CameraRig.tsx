"use client";
// 3인칭 카메라 + 묵상 시점 전환. 마우스/터치 드래그로 시점을 돌립니다.
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BOUNDS, CEILING_Y, CRUCIFIX } from "@/lib/game/chapelLayout";
import { localPlayer } from "@/store/localPlayer";
import { useApp } from "@/store/useAppStore";
import { pointerDrag } from "./pointerDrag";

const DRAG_THRESHOLD = 6;

export function CameraRig() {
  const { camera, gl } = useThree();
  const target = useRef(new THREE.Vector3());
  const desired = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3(0, 1.5, 0));
  const init = useRef(false);

  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "none";
    const down = (e: PointerEvent) => {
      if (pointerDrag.active) return;
      Object.assign(pointerDrag, { active: true, moved: false, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, id: e.pointerId });
    };
    const move = (e: PointerEvent) => {
      if (!pointerDrag.active || e.pointerId !== pointerDrag.id) return;
      const dx = e.clientX - pointerDrag.lastX;
      const dy = e.clientY - pointerDrag.lastY;
      pointerDrag.lastX = e.clientX;
      pointerDrag.lastY = e.clientY;
      if (!pointerDrag.moved && Math.hypot(e.clientX - pointerDrag.startX, e.clientY - pointerDrag.startY) > DRAG_THRESHOLD) {
        pointerDrag.moved = true;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      if (!pointerDrag.moved) return;
      const speed = e.pointerType === "touch" ? 0.006 : 0.004;
      localPlayer.camera.yaw -= dx * speed;
      localPlayer.camera.pitch = THREE.MathUtils.clamp(localPlayer.camera.pitch + dy * speed, -0.2, 1.1);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointerDrag.id) return;
      pointerDrag.active = false;
      // click 이벤트가 먼저 처리된 뒤 초기화
      setTimeout(() => (pointerDrag.moved = false), 0);
    };
    const wheel = (e: WheelEvent) => {
      localPlayer.camera.distance = THREE.MathUtils.clamp(localPlayer.camera.distance + e.deltaY * 0.003, 2.2, 7);
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const s = localPlayer.state;
    const meditation = useApp.getState().meditation && s.pose === "sit";
    const k = 1 - Math.exp(-delta * (meditation ? 1.6 : 6));
    if (meditation) {
      // 앉은 자리 눈높이에서 십자가를 바라봄
      desired.current.set(s.x, s.y + 1.12, s.z);
      target.current.set(CRUCIFIX.x, CRUCIFIX.y + 3.6, CRUCIFIX.z);
    } else {
      const { yaw, pitch, distance } = localPlayer.camera;
      const headY = s.y + (s.pose === "sit" ? 1.1 : 1.5);
      target.current.set(s.x, headY, s.z);
      desired.current.set(
        s.x + Math.sin(yaw) * Math.cos(pitch) * distance,
        headY + Math.sin(pitch) * distance,
        s.z + Math.cos(yaw) * Math.cos(pitch) * distance,
      );
      // 벽 밖으로 나가지 않게 제한 (간단한 카메라 충돌)
      desired.current.x = THREE.MathUtils.clamp(desired.current.x, BOUNDS.minX - 0.1, BOUNDS.maxX + 0.1);
      desired.current.z = THREE.MathUtils.clamp(desired.current.z, BOUNDS.minZ, BOUNDS.maxZ + 0.3);
      desired.current.y = THREE.MathUtils.clamp(desired.current.y, 0.4, CEILING_Y - 1);
    }
    if (!init.current) {
      camera.position.copy(desired.current);
      look.current.copy(target.current);
      init.current = true;
    }
    camera.position.lerp(desired.current, k);
    look.current.lerp(target.current, k);
    camera.lookAt(look.current);
  });

  return null;
}
