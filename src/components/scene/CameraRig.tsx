"use client";
// 3인칭 카메라 + 묵상 시점 전환. 마우스/터치 드래그로 시점을 돌립니다.
// 묵상 시점에서는 앉은 자리 눈높이에서 드래그로 고개를 돌려 주변을 둘러봅니다.
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BOUNDS, CEILING_Y, CRUCIFIX } from "@/lib/game/chapelLayout";
import { localPlayer } from "@/store/localPlayer";
import { useApp } from "@/store/useAppStore";
import { pointerDrag } from "./pointerDrag";
import { sceneRefs } from "./sceneRefs";

const DRAG_THRESHOLD = 6;

export function CameraRig() {
  const { camera, gl } = useThree();
  const target = useRef(new THREE.Vector3());
  const desired = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3(0, 1.5, 0));
  const init = useRef(false);
  const wasMeditating = useRef(false);
  const dir = useRef(new THREE.Vector3());

  useEffect(() => {
    sceneRefs.camera = camera;
    sceneRefs.canvas = gl.domElement;
    return () => {
      if (sceneRefs.camera === camera) sceneRefs.camera = null;
      if (sceneRefs.canvas === gl.domElement) sceneRefs.canvas = null;
    };
  }, [camera, gl]);

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
      if (useApp.getState().meditation && localPlayer.state.pose === "sit") {
        // 1인칭으로 고개 돌리기: 끄는 방향으로 시선이 따라감
        const look = localPlayer.meditationLook;
        look.yaw -= dx * speed * 0.8;
        look.pitch = THREE.MathUtils.clamp(look.pitch - dy * speed * 0.8, -1.0, 0.9);
        return;
      }
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

  useFrame((state, delta) => {
    const s = localPlayer.state;
    const app = useApp.getState();
    const intro = app.phase !== "chapel";
    const meditation = app.meditation && s.pose === "sit";
    const k = 1 - Math.exp(-delta * (intro ? 0.8 : meditation ? 1.6 : 6));
    if (intro) {
      // 입장 화면: 신랑을 따라 천천히 제단 쪽으로 다가갔다 물러나는 카메라
      const t = state.clock.elapsedTime;
      const along = (1 - Math.cos(t * 0.045)) / 2; // 0 → 1 → 0 (약 140초 주기)
      desired.current.set(Math.sin(t * 0.06) * 1.6, 2.6 + Math.sin(t * 0.08) * 0.25, 13 - along * 11);
      target.current.set(0, 4.2, CRUCIFIX.z);
    } else if (meditation) {
      // 앉은 자리 눈높이에서 십자가를 바라보는 것이 기본, 드래그한 만큼 고개를 돌림
      if (!wasMeditating.current) localPlayer.meditationLook = { yaw: 0, pitch: 0 };
      desired.current.set(s.x, s.y + 1.25, s.z - 0.05);
      const cx = CRUCIFIX.x - desired.current.x;
      const cy = CRUCIFIX.y + 3.6 - desired.current.y;
      const cz = CRUCIFIX.z - desired.current.z;
      const yaw = Math.atan2(cx, cz) + localPlayer.meditationLook.yaw;
      const pitch = THREE.MathUtils.clamp(Math.atan2(cy, Math.hypot(cx, cz)) + localPlayer.meditationLook.pitch, -1.2, 1.3);
      dir.current.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      target.current.copy(desired.current).addScaledVector(dir.current, 10);
    } else {
      const sitting = s.pose === "sit";
      const { yaw } = localPlayer.camera;
      // 앉아 있을 때는 장의자 등받이에 가리지 않도록 더 가깝고 높은 곳에서 내려다봄
      const pitch = sitting ? Math.max(localPlayer.camera.pitch, 0.55) : localPlayer.camera.pitch;
      const distance = sitting ? Math.min(localPlayer.camera.distance, 2.4) : localPlayer.camera.distance;
      const headY = s.y + (sitting ? 1.2 : 1.5);
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
    wasMeditating.current = meditation;
    // 묵상 자리에 도착한 뒤에는 고개 돌리기가 바로 따라오게 (들어가는 전환만 천천히)
    const lookK = meditation && camera.position.distanceTo(desired.current) < 0.3 ? 1 - Math.exp(-delta * 12) : k;
    if (!init.current) {
      camera.position.copy(desired.current);
      look.current.copy(target.current);
      init.current = true;
    }
    camera.position.lerp(desired.current, k);
    look.current.lerp(target.current, lookK);
    camera.lookAt(look.current);
  });

  return null;
}
