// 성호 긋기 손동작 경로와 네트워크 형식
import { test } from "node:test";
import assert from "node:assert/strict";
import { CROSS_KEYS, CROSS_MS, CROSS_POINTS, crossHandOffset } from "../src/lib/game/gestures.ts";
import { validateGesture } from "../src/lib/net/protocol.ts";

const near = (a: number[] | null, b: readonly number[]) => !!a && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
const at = (sec: number) => crossHandOffset(1000, 1000 + sec * 1000);

test("성호: 이마 → 가슴 → 왼쪽 어깨 → 오른쪽 어깨 순서 (아바타 왼쪽은 -X)", () => {
  const visits = CROSS_KEYS.map((k) => k.p);
  const order = [CROSS_POINTS.FOREHEAD, CROSS_POINTS.CHEST, CROSS_POINTS.LEFT_SHOULDER, CROSS_POINTS.RIGHT_SHOULDER].map((p) => visits.indexOf(p));
  assert.deepEqual([...order].sort((a, b) => a - b), order, "순서");
  assert.ok(CROSS_POINTS.LEFT_SHOULDER[0] < 0 && CROSS_POINTS.RIGHT_SHOULDER[0] > 0);
  assert.ok(CROSS_POINTS.FOREHEAD[1] > CROSS_POINTS.CHEST[1]);
  // 각 지점에서 잠깐 멈춤
  assert.ok(near(at(0.6), CROSS_POINTS.FOREHEAD));
  assert.ok(near(at(1.25), CROSS_POINTS.CHEST));
  assert.ok(near(at(1.8), CROSS_POINTS.LEFT_SHOULDER));
  assert.ok(near(at(2.4), CROSS_POINTS.RIGHT_SHOULDER));
});

test("성호: 시작 전·끝난 뒤·시작 안 함(0)이면 손을 숨김", () => {
  assert.equal(crossHandOffset(0, 5000), null);
  assert.equal(crossHandOffset(1000, 900), null);
  assert.equal(crossHandOffset(1000, 1000 + CROSS_MS), null);
  assert.ok(crossHandOffset(1000, 1500));
});

test("제스처 메시지: bow·cross 만 허용", () => {
  const u = "11111111-2222-3333-4444-555555555555";
  const now = Date.now();
  assert.equal(validateGesture({ v: 1, u, t: now, g: "cross" }, now)?.g, "cross");
  assert.equal(validateGesture({ v: 1, u, t: now, g: "bow" }, now)?.g, "bow");
  assert.equal(validateGesture({ v: 1, u, t: now, g: "dance" }, now), null);
});
