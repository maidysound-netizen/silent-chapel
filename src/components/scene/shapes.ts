// 고딕 아치·창문 모양과 절차적(코드로 그린) 텍스처. 외부 이미지/모델 에셋을 쓰지 않습니다.
import * as THREE from "three";

/** 뾰족 아치(첨두아치) 윤곽 점들. (cx, base) 기준, span 폭, rise 는 기둥 위로 올라가는 높이 */
export function pointedArchPoints(cx: number, base: number, span: number, rise: number, segments = 10): THREE.Vector2[] {
  const half = span / 2;
  // 두 원호의 중심을 반대편 쪽으로 두면 뾰족한 아치가 됩니다
  const r = (half * half + rise * rise) / (2 * half);
  const pts: THREE.Vector2[] = [];
  // 왼쪽 호: 중심 (cx - half + r, base)
  const lc = new THREE.Vector2(cx - half + r, base);
  const lStart = Math.PI;
  const lEnd = Math.atan2(rise, cx - lc.x);
  for (let i = 0; i <= segments; i++) {
    const a = lStart + (lEnd - lStart) * (i / segments);
    pts.push(new THREE.Vector2(lc.x + r * Math.cos(a), base + r * Math.sin(a)));
  }
  const rc = new THREE.Vector2(cx + half - r, base);
  const rStart = Math.atan2(rise, cx - rc.x);
  for (let i = 1; i <= segments; i++) {
    const a = rStart + (0 - rStart) * (i / segments);
    pts.push(new THREE.Vector2(rc.x + r * Math.cos(a), base + r * Math.sin(a)));
  }
  return pts;
}

/** 아래가 사각형이고 위가 뾰족한 창/문 모양 (경로) */
export function lancetPath(cx: number, bottom: number, width: number, springY: number, rise: number): THREE.Path {
  const path = new THREE.Path();
  const half = width / 2;
  path.moveTo(cx - half, bottom);
  const arch = pointedArchPoints(cx, springY, width, rise);
  for (const p of arch) path.lineTo(p.x, p.y);
  path.lineTo(cx + half, bottom);
  path.lineTo(cx - half, bottom);
  return path;
}

export function lancetShape(width: number, height: number, rise: number): THREE.Shape {
  const s = new THREE.Shape();
  const half = width / 2;
  s.moveTo(-half, 0);
  for (const p of pointedArchPoints(0, height - rise, width, rise)) s.lineTo(p.x, p.y);
  s.lineTo(half, 0);
  s.lineTo(-half, 0);
  return s;
}

/** ShapeGeometry의 UV를 0..1로 정규화 (텍스처가 모양 전체에 맞도록) */
export function normalizeUVs(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const w = bb.max.x - bb.min.x || 1;
  const h = bb.max.y - bb.min.y || 1;
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - bb.min.x) / w;
    uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / h;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** 결정적 의사난수 (같은 seed → 같은 무늬) */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const GLASS_PALETTES = [
  ["#1d3f8f", "#2a5bc4", "#b3242a", "#d9a42b", "#2f7d4a", "#6b2f8f"],
  ["#173a7a", "#3366b8", "#c7902a", "#a02030", "#e0c060", "#2b6e5a"],
  ["#22407f", "#8f1f2f", "#d4ae3c", "#3f8f6a", "#4a63c9", "#7a3a99"],
];

/** 납선(lead line)이 있는 스테인드글라스 텍스처 */
export function stainedGlassTexture(seed: number, w = 128, h = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const rand = rng(seed);
  const pal = GLASS_PALETTES[seed % GLASS_PALETTES.length];
  // 마름모 격자 조각
  const cell = 16;
  for (let y = -cell; y < h + cell; y += cell) {
    for (let x = -cell; x < w + cell; x += cell) {
      const off = (Math.floor(y / cell) % 2) * (cell / 2);
      g.fillStyle = pal[Math.floor(rand() * pal.length)];
      g.beginPath();
      g.moveTo(x + off, y);
      g.lineTo(x + off + cell / 2, y + cell / 2);
      g.lineTo(x + off, y + cell);
      g.lineTo(x + off - cell / 2, y + cell / 2);
      g.closePath();
      g.fill();
    }
  }
  // 가운데 메달리온(원형 문양)
  for (let i = 0; i < 3; i++) {
    const cy = h * (0.25 + i * 0.25);
    const r = w * 0.3;
    const grad = g.createRadialGradient(w / 2, cy, 2, w / 2, cy, r);
    grad.addColorStop(0, "#f6e7b0");
    grad.addColorStop(0.5, pal[(i + 2) % pal.length]);
    grad.addColorStop(1, pal[(i + 4) % pal.length]);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(w / 2, cy, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#1a1410";
    g.lineWidth = 3;
    g.stroke();
    // 사엽 장식
    g.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      g.moveTo(w / 2, cy);
      g.lineTo(w / 2 + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.stroke();
  }
  // 납선 격자
  g.strokeStyle = "rgba(20,14,10,0.9)";
  g.lineWidth = 1.5;
  for (let y = 0; y < h; y += cell) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  g.lineWidth = 4;
  g.strokeRect(2, 2, w - 4, h - 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 장미창(원형 스테인드글라스) */
export function roseWindowTexture(size = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const cx = size / 2;
  const pal = GLASS_PALETTES[0];
  for (let ring = 4; ring >= 1; ring--) {
    const r = (ring / 4) * (size / 2 - 4);
    const petals = ring * 6;
    for (let i = 0; i < petals; i++) {
      const a0 = (i / petals) * Math.PI * 2;
      const a1 = ((i + 1) / petals) * Math.PI * 2;
      g.fillStyle = pal[(i + ring) % pal.length];
      g.beginPath();
      g.moveTo(cx, cx);
      g.arc(cx, cx, r, a0, a1);
      g.closePath();
      g.fill();
      g.strokeStyle = "#1a1410";
      g.lineWidth = 2;
      g.stroke();
    }
  }
  g.fillStyle = "#f3dc8a";
  g.beginPath();
  g.arc(cx, cx, size * 0.08, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 돌바닥 텍스처 (체크 무늬 + 약간의 얼룩) */
export function stoneFloorTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const rand = rng(7);
  const tile = size / 4;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const light = (x + y) % 2 === 0;
      const v = (light ? 128 : 104) + Math.floor(rand() * 12);
      g.fillStyle = `rgb(${v + 8},${v},${v - 10})`;
      g.fillRect(x * tile, y * tile, tile, tile);
    }
  }
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(0,0,0,${rand() * 0.05})`;
    g.fillRect(rand() * size, rand() * size, 2 + rand() * 6, 2 + rand() * 6);
  }
  g.strokeStyle = "rgba(40,30,20,0.6)";
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath();
    g.moveTo(i * tile, 0);
    g.lineTo(i * tile, size);
    g.moveTo(0, i * tile);
    g.lineTo(size, i * tile);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
