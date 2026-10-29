// 묵주기도 순서·상태 전이 테스트 (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRosarySequence,
  changeOptions,
  completedBeads,
  nextStep,
  prevStep,
  sanitizeProgress,
  setPaused,
  startProgress,
  suggestedMysteryForDay,
} from "../src/lib/rosary/sequence.ts";

const ALL = { includeFatima: true, includeClosingPrayer: true };
const NONE = { includeFatima: false, includeClosingPrayer: false };

test("시작 기도: 십자성호 → 사도신경 → 주님의 기도 → 성모송×3 → 영광송", () => {
  const s = buildRosarySequence(ALL);
  assert.deepEqual(
    s.slice(0, 7).map((x) => x.kind),
    ["signOfCross", "creed", "ourFather", "hailMary", "hailMary", "hailMary", "gloryBe"],
  );
  assert.deepEqual(s.slice(3, 6).map((x) => x.hailMary), [{ n: 1, of: 3 }, { n: 2, of: 3 }, { n: 3, of: 3 }]);
});

test("각 단: 신비 → 주님의 기도 → 성모송×10 → 영광송 → 구원을 비는 기도", () => {
  const s = buildRosarySequence(ALL);
  for (let d = 1; d <= 5; d++) {
    const dec = s.filter((x) => x.decade === d);
    assert.equal(dec.length, 14, `제${d}단 단계 수`);
    assert.equal(dec[0].kind, "mystery");
    assert.equal(dec[1].kind, "ourFather");
    for (let i = 0; i < 10; i++) {
      assert.equal(dec[2 + i].kind, "hailMary");
      assert.deepEqual(dec[2 + i].hailMary, { n: i + 1, of: 10 });
    }
    assert.equal(dec[12].kind, "gloryBe");
    assert.equal(dec[13].kind, "fatima");
    assert.equal(dec[13].optional, true);
  }
});

test("단 순서는 1→5 로 연속", () => {
  const decades = buildRosarySequence(ALL).map((x) => x.decade).filter((d) => d > 0);
  for (let i = 1; i < decades.length; i++) assert.ok(decades[i] >= decades[i - 1]);
});

test("마침: 성모 찬송 → 마침 기도 → 십자성호", () => {
  const s = buildRosarySequence(ALL);
  assert.deepEqual(s.slice(-3).map((x) => x.kind), ["hailHolyQueen", "closingPrayer", "signOfCross"]);
  assert.equal(s.length, 7 + 5 * 14 + 3);
});

test("선택 기도를 빼면 해당 단계가 사라짐", () => {
  const s = buildRosarySequence(NONE);
  assert.equal(s.filter((x) => x.kind === "fatima").length, 0);
  assert.equal(s.filter((x) => x.kind === "closingPrayer").length, 0);
  assert.equal(s.length, 7 + 5 * 13 + 2);
  assert.equal(s.filter((x) => x.kind === "hailMary").length, 53);
});

test("index 가 0부터 연속", () => {
  buildRosarySequence(ALL).forEach((x, i) => assert.equal(x.index, i));
});

test("다음/이전/완료/멈춤 전이", () => {
  let p = startProgress("joyful", ALL, 1);
  assert.equal(p.stepIndex, 0);
  p = prevStep(p, 2);
  assert.equal(p.stepIndex, 0, "처음에서 이전은 그대로");
  const total = buildRosarySequence(ALL).length;
  for (let i = 0; i < total - 1; i++) p = nextStep(p, 3);
  assert.equal(p.stepIndex, total - 1);
  assert.equal(p.status, "praying");
  p = nextStep(p, 4);
  assert.equal(p.status, "complete");
  assert.equal(nextStep(p, 5), p, "완료 후 다음은 변화 없음");
  p = prevStep(p, 6);
  assert.equal(p.status, "praying");
  p = setPaused(p, true, 7);
  assert.equal(p.status, "paused");
  assert.equal(setPaused(p, false, 8).status, "praying");
});

test("옵션 변경 시 같은 위치 유지", () => {
  let p = startProgress("sorrowful", ALL, 1);
  for (let i = 0; i < 15; i++) p = nextStep(p); // 제1단 성모송 진행 중
  const before = buildRosarySequence(ALL)[p.stepIndex];
  const q = changeOptions(p, NONE);
  const after = buildRosarySequence(NONE)[q.stepIndex];
  assert.equal(after.kind, before.kind);
  assert.equal(after.decade, before.decade);
  assert.deepEqual(after.hailMary, before.hailMary);
});

test("선택 기도 위치에서 그 기도를 끄면 바로 앞 영광송으로", () => {
  const steps = buildRosarySequence(ALL);
  const fat = steps.findIndex((x) => x.kind === "fatima" && x.decade === 2);
  const p = { ...startProgress("glorious", ALL), stepIndex: fat };
  const q = changeOptions(p, NONE);
  const s = buildRosarySequence(NONE)[q.stepIndex];
  assert.equal(s.kind, "gloryBe");
  assert.equal(s.decade, 2);
});

test("저장 데이터 검증: 손상된 값은 거부", () => {
  const ok = startProgress("luminous", ALL, 10);
  assert.deepEqual(sanitizeProgress(JSON.parse(JSON.stringify(ok))), ok);
  assert.equal(sanitizeProgress(null), null);
  assert.equal(sanitizeProgress({ ...ok, mystery: "x" }), null);
  assert.equal(sanitizeProgress({ ...ok, stepIndex: 999 }), null);
  assert.equal(sanitizeProgress({ ...ok, stepIndex: -1 }), null);
  assert.equal(sanitizeProgress({ ...ok, version: 2 }), null);
});

test("요일별 신비", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(suggestedMysteryForDay), [
    "glorious", "joyful", "sorrowful", "glorious", "luminous", "sorrowful", "joyful",
  ]);
});

test("묵주알 완료 표시: 한 알의 마지막 기도까지 끝나야 완료", () => {
  const s = buildRosarySequence(ALL);
  const mysteryIdx = s.findIndex((x) => x.kind === "mystery" && x.decade === 1);
  assert.ok(!completedBeads(s, mysteryIdx + 1, false).has("dl1"), "주님의 기도 중엔 아직 미완료");
  assert.ok(completedBeads(s, mysteryIdx + 2, false).has("dl1"));
  assert.ok(!completedBeads(s, s.length - 1, false).has("cross"), "마지막 십자성호 전 십자가 미완료");
  assert.ok(completedBeads(s, s.length - 1, true).has("cross"));
  // 전체 묵주알 수: 십자가1 + 펜던트 큰알1 + 작은알3 + 메달1 + 큰알5 + 작은알50
  assert.equal(completedBeads(s, 0, true).size, 61);
});
