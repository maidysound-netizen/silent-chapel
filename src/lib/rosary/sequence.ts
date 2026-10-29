// 묵주기도 진행 순서 생성기와 상태 전이 함수 (순수 함수).
//
// 구조 (교황 요한 바오로 2세, 교황 교서 「동정 마리아의 묵주기도」 및 한국 교회 관습 기준):
//   십자성호 → 사도신경 → 주님의 기도 → 성모송 ×3 → 영광송
//   → [각 단] 신비 묵상 → 주님의 기도 → 성모송 ×10 → 영광송 → (구원을 비는 기도)
//   → 성모 찬송 → (마침 기도) → 십자성호

import type {
  MysteryId,
  RosaryOptions,
  RosaryProgress,
  RosaryStep,
  PrayerKind,
  BeadRef,
} from "./types.ts";
import { DEFAULT_ROSARY_OPTIONS } from "./types.ts";

export const DECADES = 5;
export const HAIL_MARYS_PER_DECADE = 10;
export const INTRO_HAIL_MARYS = 3;

export function buildRosarySequence(options: RosaryOptions = DEFAULT_ROSARY_OPTIONS): RosaryStep[] {
  const steps: RosaryStep[] = [];
  const push = (
    kind: PrayerKind,
    decade: number,
    bead: BeadRef | null,
    extra: Partial<Pick<RosaryStep, "hailMary" | "optional">> = {},
  ) => {
    steps.push({ index: steps.length, kind, decade, bead, optional: extra.optional ?? false, hailMary: extra.hailMary });
  };

  // 시작 기도
  push("signOfCross", 0, { kind: "cross" });
  push("creed", 0, { kind: "cross" });
  push("ourFather", 0, { kind: "pendantLarge" });
  for (let i = 0; i < INTRO_HAIL_MARYS; i++) {
    push("hailMary", 0, { kind: "pendantSmall", index: i }, { hailMary: { n: i + 1, of: INTRO_HAIL_MARYS } });
  }
  push("gloryBe", 0, { kind: "pendantSmall", index: INTRO_HAIL_MARYS - 1 });

  // 다섯 단 (제1단의 큰 알은 펜던트 위쪽 큰 알, 제2~5단은 고리 위의 큰 알)
  for (let d = 1; d <= DECADES; d++) {
    push("mystery", d, { kind: "decadeLarge", decade: d });
    push("ourFather", d, { kind: "decadeLarge", decade: d });
    for (let i = 0; i < HAIL_MARYS_PER_DECADE; i++) {
      push("hailMary", d, { kind: "decadeSmall", decade: d, index: i }, { hailMary: { n: i + 1, of: HAIL_MARYS_PER_DECADE } });
    }
    push("gloryBe", d, { kind: "decadeSmall", decade: d, index: HAIL_MARYS_PER_DECADE - 1 });
    if (options.includeFatima) {
      push("fatima", d, { kind: "decadeSmall", decade: d, index: HAIL_MARYS_PER_DECADE - 1 }, { optional: true });
    }
  }

  // 마침 기도
  push("hailHolyQueen", 0, { kind: "medal" });
  if (options.includeClosingPrayer) push("closingPrayer", 0, { kind: "medal" }, { optional: true });
  push("signOfCross", 0, { kind: "cross" });

  return steps;
}

/** 요일별 전통적인 신비 배정 (0 = 일요일) */
export function suggestedMysteryForDay(day: number): MysteryId {
  switch (day) {
    case 1:
    case 6:
      return "joyful";
    case 2:
    case 5:
      return "sorrowful";
    case 4:
      return "luminous";
    default:
      return "glorious"; // 수요일, 일요일
  }
}

export function startProgress(mystery: MysteryId, options: RosaryOptions = DEFAULT_ROSARY_OPTIONS, now = Date.now()): RosaryProgress {
  return { version: 1, mystery, options: { ...options }, stepIndex: 0, status: "praying", startedAt: now, updatedAt: now };
}

export function nextStep(p: RosaryProgress, now = Date.now()): RosaryProgress {
  if (p.status === "complete") return p;
  const total = buildRosarySequence(p.options).length;
  if (p.stepIndex >= total - 1) return { ...p, stepIndex: total - 1, status: "complete", updatedAt: now };
  return { ...p, stepIndex: p.stepIndex + 1, status: "praying", updatedAt: now };
}

export function prevStep(p: RosaryProgress, now = Date.now()): RosaryProgress {
  if (p.status === "complete") return { ...p, status: "praying", updatedAt: now };
  return { ...p, stepIndex: Math.max(0, p.stepIndex - 1), status: "praying", updatedAt: now };
}

export function setPaused(p: RosaryProgress, paused: boolean, now = Date.now()): RosaryProgress {
  if (p.status === "complete") return p;
  return { ...p, status: paused ? "paused" : "praying", updatedAt: now };
}

/** 옵션을 바꿔도 같은 기도 위치를 최대한 유지합니다. */
export function changeOptions(p: RosaryProgress, options: RosaryOptions, now = Date.now()): RosaryProgress {
  const oldSteps = buildRosarySequence(p.options);
  const newSteps = buildRosarySequence(options);
  const cur = oldSteps[p.stepIndex];
  let idx = newSteps.findIndex(
    (s) => s.kind === cur.kind && s.decade === cur.decade && s.hailMary?.n === cur.hailMary?.n &&
      // 시작/마침 십자성호 구분
      (s.kind !== "signOfCross" || (s.index === 0) === (cur.index === 0)),
  );
  if (idx < 0) {
    // 제거된 선택 기도에 있었다면 바로 앞 단계로
    idx = newSteps.findIndex((s) => s.kind === "gloryBe" && s.decade === cur.decade);
    if (cur.kind === "closingPrayer") idx = newSteps.findIndex((s) => s.kind === "hailHolyQueen");
    if (idx < 0) idx = Math.min(p.stepIndex, newSteps.length - 1);
  }
  return { ...p, options: { ...options }, stepIndex: idx, updatedAt: now };
}

/** 저장된 데이터가 손상되었거나 다른 버전이면 null */
export function sanitizeProgress(raw: unknown): RosaryProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const mysteries: MysteryId[] = ["joyful", "sorrowful", "glorious", "luminous"];
  if (r.version !== 1 || !mysteries.includes(r.mystery as MysteryId)) return null;
  const o = (r.options ?? {}) as Record<string, unknown>;
  const options: RosaryOptions = {
    includeFatima: typeof o.includeFatima === "boolean" ? o.includeFatima : DEFAULT_ROSARY_OPTIONS.includeFatima,
    includeClosingPrayer:
      typeof o.includeClosingPrayer === "boolean" ? o.includeClosingPrayer : DEFAULT_ROSARY_OPTIONS.includeClosingPrayer,
  };
  const total = buildRosarySequence(options).length;
  const stepIndex = Number(r.stepIndex);
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= total) return null;
  const status = r.status === "paused" || r.status === "complete" ? r.status : "praying";
  const startedAt = Number(r.startedAt) || Date.now();
  const updatedAt = Number(r.updatedAt) || startedAt;
  return { version: 1, mystery: r.mystery as MysteryId, options, stepIndex, status, startedAt, updatedAt };
}

/** 묵주알 id 문자열 (시각화용) */
export function beadKey(b: BeadRef): string {
  switch (b.kind) {
    case "cross":
    case "pendantLarge":
    case "medal":
      return b.kind;
    case "pendantSmall":
      return `ps${b.index}`;
    case "decadeLarge":
      return `dl${b.decade}`;
    case "decadeSmall":
      return `ds${b.decade}-${b.index}`;
  }
}

/**
 * '기도를 마친' 묵주알 집합. 한 알에서 여러 기도를 바치는 경우(예: 큰 알에서 신비 묵상 + 주님의 기도)
 * 그 알의 마지막 기도까지 끝나야 완료로 표시합니다.
 */
export function completedBeads(steps: RosaryStep[], stepIndex: number, complete: boolean): Set<string> {
  const lastIndex = new Map<string, number>();
  for (const s of steps) if (s.bead) lastIndex.set(beadKey(s.bead), s.index);
  const done = new Set<string>();
  for (const [key, last] of lastIndex) if (complete || last < stepIndex) done.add(key);
  return done;
}
