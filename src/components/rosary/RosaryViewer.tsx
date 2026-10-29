"use client";
// 묵주기도 패널의 3D 묵주. 손가락으로 알을 굴리듯 조작합니다.
//   아래로 끌기(또는 휠) → 다음 알,  위로 끌기 → 이전 알,  가볍게 탭/클릭 → 다음 알
import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RosaryModel } from "./RosaryModel";

const ROLL_PX = 34; // 이만큼 끌면 알 하나
const TAP_PX = 6;

/** 금속·광택 반사를 위한 환경광 (네트워크 없이 코드로 생성) */
function RoomLighting() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** 묵주 전체(고리 위 끝 ~ 십자가 아래 끝)가 세로로 길게 다 보이도록 카메라 거리를 맞춤 */
const BOUNDS = { cy: 0.4, halfH: 2.3, halfW: 1.25 };
function FullViewCamera() {
  const { size } = useThree();
  useFrame(({ camera }, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const aspect = size.width / Math.max(1, size.height);
    const dist = Math.max(BOUNDS.halfH / t, BOUNDS.halfW / (t * aspect));
    const k = 1 - Math.exp(-delta * 4);
    cam.position.x += (0 - cam.position.x) * k;
    cam.position.y += (BOUNDS.cy - cam.position.y) * k;
    cam.position.z += (dist - cam.position.z) * k;
    cam.lookAt(0, BOUNDS.cy, 0);
  });
  return null;
}

/** 줄에 매달린 묵주가 아주 천천히 흔들림 */
function Sway({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (g.current) g.current.rotation.y = Math.sin(clock.elapsedTime * 0.3) * 0.12;
  });
  return <group ref={g}>{children}</group>;
}

export interface RosaryViewerProps {
  done: ReadonlySet<string>;
  currentKey: string | null;
  onNext: () => void;
  onPrev: () => void;
  /** 화면 읽기 프로그램/툴팁용 조작 안내 (화면에는 묵주만 표시) */
  hint: string;
}

export default function RosaryViewer({ done, currentKey, onNext, onPrev, hint }: RosaryViewerProps) {
  const drag = useRef({ id: -1, startY: 0, lastY: 0, acc: 0, moved: 0 });
  const wheelAt = useRef(0);
  const handlers = useRef({ onNext, onPrev });
  handlers.current = { onNext, onPrev };

  return (
    <div
      className="rosary-3d"
      aria-hidden="true"
      title={hint}
      onPointerDown={(e) => {
        drag.current = { id: e.pointerId, startY: e.clientY, lastY: e.clientY, acc: 0, moved: 0 };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d.id !== e.pointerId) return;
        const dy = e.clientY - d.lastY;
        d.lastY = e.clientY;
        d.acc += dy;
        d.moved += Math.abs(dy);
        while (d.acc >= ROLL_PX) {
          d.acc -= ROLL_PX;
          handlers.current.onNext();
        }
        while (d.acc <= -ROLL_PX) {
          d.acc += ROLL_PX;
          handlers.current.onPrev();
        }
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        if (d.id !== e.pointerId) return;
        if (d.moved < TAP_PX) handlers.current.onNext();
        d.id = -1;
      }}
      onPointerCancel={() => (drag.current.id = -1)}
      onWheel={(e) => {
        const now = performance.now();
        if (now - wheelAt.current < 220 || Math.abs(e.deltaY) < 4) return;
        wheelAt.current = now;
        if (e.deltaY > 0) handlers.current.onNext();
        else handlers.current.onPrev();
      }}
    >
      <Canvas dpr={[1, 2]} camera={{ fov: 35, near: 0.05, far: 40, position: [0, 0.4, 8] }} gl={{ antialias: true, alpha: true }}>
        <RoomLighting />
        <ambientLight intensity={0.25} />
        <directionalLight position={[2, 3, 4]} intensity={1.1} color="#fff1dc" />
        <directionalLight position={[-3, -1, -2]} intensity={0.4} color="#9fb4ff" />
        <Sway>
          <RosaryModel done={done} currentKey={currentKey} showFinger={false} />
        </Sway>
        <FullViewCamera />
      </Canvas>
    </div>
  );
}
