"use client";
// 3D 캔버스. 품질 설정에 따라 해상도(dpr)·그림자·안티앨리어싱을 조절합니다.
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import { useApp } from "@/store/useAppStore";
import { getUi } from "@/lib/i18n";
import { Architecture } from "./Architecture";
import { Furnishings } from "./Furnishings";
import { BibleObject, RosaryObject } from "./Interactables";
import { Lighting } from "./Lighting";
import { LocalPlayer } from "./LocalPlayer";
import { RemoteAvatars } from "./RemoteAvatars";
import { CameraRig } from "./CameraRig";

// 낮은 품질(휴대폰 기본)도 최소 1배로: 0.75배는 화면이 뭉개져 조각상 디테일이 사라짐. 느리면 AdaptiveDpr 가 낮춤
const DPR: Record<string, [number, number]> = { low: [1, 1.25], medium: [1, 1.5], high: [1, 2] };

export default function ChapelCanvas() {
  const quality = useApp((s) => s.settings.quality);
  const locale = useApp((s) => s.settings.locale);
  return (
    <Canvas
      key={quality /* 안티앨리어싱/그림자 변경은 캔버스 재생성이 필요 */}
      className="chapel-canvas"
      shadows={quality === "high"}
      dpr={DPR[quality]}
      gl={{ antialias: quality !== "low", powerPreference: quality === "low" ? "low-power" : "high-performance" }}
      camera={{ fov: 60, near: 0.1, far: 120, position: [0, 3, 18] }}
      aria-label={getUi(locale).canvasLabel}
    >
      <Lighting quality={quality} />
      <Architecture quality={quality} />
      <Furnishings />
      <RosaryObject />
      <BibleObject />
      <LocalPlayer />
      <RemoteAvatars />
      <CameraRig />
      {quality !== "high" && <AdaptiveDpr pixelated={false} />}
    </Canvas>
  );
}
