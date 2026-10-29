// 3D 묵주의 모양(각 묵주알의 위치). 순수 데이터라 렌더링과 테스트가 함께 씁니다.
// 단위는 '묵주 좌표'(메달 = 원점, 고리 지름 약 2). 실제 크기는 렌더링에서 scale로 맞춥니다.
//
// 실제 묵주 구조:  십자가 ─ 큰 알 ─ 작은 알 3 ─ 큰 알(제1단) ─ 메달 ─ 고리(제1단 10알 · 큰 알 · … · 제5단 10알) ─ 메달
import { beadKey } from "./sequence.ts";

export type BeadKind = "small" | "large" | "medal" | "cross";

export interface BeadPlacement {
  key: string;
  kind: BeadKind;
  position: [number, number, number];
  radius: number;
}

export const SMALL_R = 0.05;
export const LARGE_R = 0.07;

const LOOP_CENTER_Y = 1.27;
const LOOP_RX = 1.05;
const LOOP_RY = 1.25;

/** 고리 위 한 점 (u: 0 = 메달, 0→1 로 한 바퀴) — 살짝 비틀어 입체감을 줌 */
export function loopPoint(u: number): [number, number, number] {
  const a = -Math.PI / 2 + u * Math.PI * 2;
  return [LOOP_RX * Math.cos(a), LOOP_CENTER_Y + LOOP_RY * Math.sin(a), 0.16 * Math.sin(a * 2)];
}

/** 모든 묵주알 위치 (물리적 순서: 십자가 → 펜던트 → 메달 → 고리) */
export function buildRosaryShape(): BeadPlacement[] {
  const out: BeadPlacement[] = [];
  // 펜던트 (메달 아래로 늘어짐)
  out.push({ key: "cross", kind: "cross", position: [0, -1.5, 0], radius: 0.16 });
  out.push({ key: "pendantLarge", kind: "large", position: [0, -1.06, 0], radius: LARGE_R });
  for (let i = 0; i < 3; i++) {
    out.push({ key: beadKey({ kind: "pendantSmall", index: i }), kind: "small", position: [0, -0.86 + i * 0.14, 0], radius: SMALL_R });
  }
  out.push({ key: beadKey({ kind: "decadeLarge", decade: 1 }), kind: "large", position: [0, -0.28, 0], radius: LARGE_R });
  out.push({ key: "medal", kind: "medal", position: [0, 0, 0], radius: 0.1 });
  // 고리: 제1단 10알 → 제2단 큰 알 → … → 제5단 10알 (54 자리 + 메달 자리)
  const slots: { key: string; kind: BeadKind }[] = [];
  for (let d = 1; d <= 5; d++) {
    if (d > 1) slots.push({ key: beadKey({ kind: "decadeLarge", decade: d }), kind: "large" });
    for (let i = 0; i < 10; i++) slots.push({ key: beadKey({ kind: "decadeSmall", decade: d, index: i }), kind: "small" });
  }
  const total = slots.length + 1;
  slots.forEach((s, i) => {
    out.push({ key: s.key, kind: s.kind, position: loopPoint((i + 1) / total), radius: s.kind === "large" ? LARGE_R : SMALL_R });
  });
  return out;
}

/** 줄(사슬)이 지나가는 점들: 펜던트는 십자가 위→메달, 고리는 메달에서 시작해 메달로 닫힘 */
export function chainPaths(shape: BeadPlacement[]): { pendant: [number, number, number][]; loop: [number, number, number][] } {
  const byKey = new Map(shape.map((b) => [b.key, b]));
  const pendantKeys = ["pendantLarge", "ps0", "ps1", "ps2", "dl1", "medal"];
  const pendant: [number, number, number][] = [[0, -1.32, 0], ...pendantKeys.map((k) => byKey.get(k)!.position)];
  const loop: [number, number, number][] = [];
  const steps = 96;
  for (let i = 0; i <= steps; i++) loop.push(loopPoint(i / steps));
  return { pendant, loop };
}
