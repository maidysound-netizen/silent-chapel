"use client";
// 묵주 시각화. 기도를 마친 알은 금빛으로, 지금 기도하는 알은 은은하게 빛납니다.
// 화면 읽기 프로그램에는 숨기고(aria-hidden) 같은 정보를 글로 따로 제공합니다.
import { useMemo } from "react";
import type { BeadRef, RosaryStep } from "@/lib/rosary/types";
import { beadKey, completedBeads } from "@/lib/rosary/sequence";

interface BeadPos {
  key: string;
  x: number;
  y: number;
  r: number;
  kind: "small" | "large" | "medal" | "cross";
}

const CX = 150;
const CY = 128;
const R = 104;

function layout(): BeadPos[] {
  const out: BeadPos[] = [];
  // 고리: 메달(아래) → 제1단 10알 → 제2단 큰 알 → ... → 제5단 10알 → 메달
  const slots: { key: string; kind: "small" | "large" }[] = [];
  for (let d = 1; d <= 5; d++) {
    if (d > 1) slots.push({ key: beadKey({ kind: "decadeLarge", decade: d }), kind: "large" });
    for (let i = 0; i < 10; i++) slots.push({ key: beadKey({ kind: "decadeSmall", decade: d, index: i }), kind: "small" });
  }
  const total = slots.length + 1; // + 메달 자리
  slots.forEach((s, i) => {
    // 메달에서 시작해 시계 반대 방향(화면상 오른쪽 위로)으로 진행
    const a = Math.PI / 2 - ((i + 1) / total) * Math.PI * 2;
    out.push({ key: s.key, x: CX + Math.cos(a) * R, y: CY + Math.sin(a) * R, r: s.kind === "large" ? 6.5 : 4.6, kind: s.kind });
  });
  const medalY = CY + R + 4;
  out.push({ key: "medal", x: CX, y: medalY, r: 7.5, kind: "medal" });
  // 펜던트 (메달 아래로)
  out.push({ key: beadKey({ kind: "decadeLarge", decade: 1 }), x: CX, y: medalY + 22, r: 6.5, kind: "large" });
  for (let i = 2; i >= 0; i--) {
    out.push({ key: beadKey({ kind: "pendantSmall", index: i }), x: CX, y: medalY + 40 + (2 - i) * 15, r: 4.6, kind: "small" });
  }
  out.push({ key: "pendantLarge", x: CX, y: medalY + 102, r: 6.5, kind: "large" });
  out.push({ key: "cross", x: CX, y: medalY + 132, r: 0, kind: "cross" });
  return out;
}

const LAYOUT = layout();

export function RosaryBeadsSvg({ steps, stepIndex, complete }: { steps: RosaryStep[]; stepIndex: number; complete: boolean }) {
  const done = useMemo(() => completedBeads(steps, stepIndex, complete), [steps, stepIndex, complete]);
  const currentBead: BeadRef | null = complete ? null : steps[stepIndex]?.bead ?? null;
  const current = currentBead ? beadKey(currentBead) : null;
  const medalY = CY + R + 4;

  return (
    <svg viewBox="0 0 300 400" className="rosary-svg" aria-hidden="true" focusable="false">
      {/* 줄 */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--chain)" strokeWidth={1.2} />
      <line x1={CX} y1={medalY} x2={CX} y2={medalY + 120} stroke="var(--chain)" strokeWidth={1.2} />
      {LAYOUT.map((b) => {
        const state = b.key === current ? "current" : done.has(b.key) ? "done" : "todo";
        if (b.kind === "cross") {
          return (
            <g key={b.key} className={`bead bead-${state}`} transform={`translate(${b.x} ${b.y})`}>
              <rect x={-3} y={-14} width={6} height={30} rx={1} />
              <rect x={-11} y={-6} width={22} height={6} rx={1} />
            </g>
          );
        }
        if (b.kind === "medal") {
          return (
            <g key={b.key} className={`bead bead-${state}`}>
              <ellipse cx={b.x} cy={b.y} rx={b.r} ry={b.r * 1.25} />
            </g>
          );
        }
        return <circle key={b.key} className={`bead bead-${state}`} cx={b.x} cy={b.y} r={b.r} />;
      })}
    </svg>
  );
}
