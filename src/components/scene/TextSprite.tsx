"use client";
// 3D 공간에 떠 있는 글씨(항상 카메라를 향하는 판). 방문자 이름표에 씁니다.
// 캔버스에 직접 그리므로 한글·일본어도 시스템 글꼴로 표시되고, DOM 오버레이보다 가볍습니다.
// (눌러야 하는 행동 안내는 HTML 버튼인 ui/PromptOverlay 를 씁니다)
import { useEffect, useMemo } from "react";
import * as THREE from "three";

function makeTexture(text: string) {
  const scale = 2;
  const font = `${14 * scale}px -apple-system, "Apple SD Gothic Neo", "Hiragino Sans", "Noto Sans KR", "Noto Sans JP", sans-serif`;
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 20 * scale;
  const h = 24 * scale;
  c.width = w;
  c.height = h;
  g.font = font;
  g.fillStyle = "rgba(15,10,6,0.7)";
  g.beginPath();
  g.roundRect(0, 0, w, h, h / 2);
  g.fill();
  g.fillStyle = "#efe6d4";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + scale);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { texture: t, aspect: w / h };
}

export function TextSprite({ text, position, height = 0.3 }: { text: string; position: [number, number, number]; height?: number }) {
  const { texture, aspect } = useMemo(() => makeTexture(text), [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}
