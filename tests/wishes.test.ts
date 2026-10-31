// 소원 초: 글 검사, 하루 지나면 안 보임, 초 자리
import { test } from "node:test";
import assert from "node:assert/strict";
import { activeWishes, candleSlot, isValidWish, randomWishColor, sanitizeWish, WISH_COLORS, WISH_MAX, WISH_SLOTS, WISH_TTL_MS } from "../src/lib/wishes.ts";
import { CANDLE_RACKS, COLLIDER_BOXES, MARY, ROSE_ALTAR } from "../src/lib/game/chapelLayout.ts";

test("소원 글: 줄바꿈·제어 문자 정리, 60자 제한, 빈 글 거부", () => {
  assert.equal(sanitizeWish("  가족이\n\n건강하길  "), "가족이 건강하길");
  assert.equal(Array.from(sanitizeWish("가".repeat(100))).length, WISH_MAX);
  assert.equal(isValidWish(""), false);
  assert.equal(isValidWish("   "), false);
  assert.equal(isValidWish("평화"), true);
  assert.equal(isValidWish("줄\n바꿈"), false);
});

test("초 색깔: 12가지 중 무작위", () => {
  assert.equal(WISH_COLORS.length, 12);
  assert.equal(randomWishColor(() => 0), 0);
  assert.equal(randomWishColor(() => 0.9999), 11);
});

test("하루가 지난 초는 안 보이고, 새 초부터", () => {
  const now = 1_000_000_000_000;
  const mk = (id: number, ago: number) => ({ id, userId: "u", nickname: "n", wish: "w", color: 0, createdAt: now - ago });
  const list = activeWishes([mk(1, 1000), mk(2, WISH_TTL_MS + 1), mk(3, 10)], now);
  assert.deepEqual(list.map((c) => c.id), [3, 1]);
});

test("초 자리: 제단 두 곳에 48개씩 96개, 겹치지 않고, 첫째 제단부터 채움", () => {
  assert.equal(WISH_SLOTS, 96);
  const slots = Array.from({ length: WISH_SLOTS }, (_, i) => candleSlot(i));
  assert.equal(slots[0].rack, 0);
  assert.equal(slots[47].rack, 0);
  assert.equal(slots[48].rack, 1);
  for (const s of slots) {
    const r = CANDLE_RACKS[s.rack];
    assert.ok(Math.abs(s.z - r.z) < r.width / 2, `z=${s.z}`);
    assert.ok(Math.abs(s.x - r.x) < r.depth / 2);
  }
  for (let i = 0; i < slots.length; i++)
    for (let k = i + 1; k < slots.length; k++) assert.ok(Math.hypot(slots[i].x - slots[k].x, slots[i].z - slots[k].z) > 0.1, `${i}·${k}`);
  // 앞단(신자석 쪽)이 낮음: 둘째 제단은 정면이 -X
  assert.ok(candleSlot(48).x < candleSlot(48 + 32).x, "둘째 제단 뒷단이 벽 쪽(+X)");
  // 성모상 꽃 선반·장미 제단과 충돌 상자가 겹치지 않음
  const boxOf = (x: number, z: number) => COLLIDER_BOXES.find((b) => b.x === x && b.z === z)!;
  const overlap = (a: { x: number; z: number; hx: number; hz: number }, b: typeof a) => Math.abs(a.x - b.x) < a.hx + b.hx && Math.abs(a.z - b.z) < a.hz + b.hz;
  assert.equal(overlap(boxOf(CANDLE_RACKS[0].x, CANDLE_RACKS[0].z), boxOf(MARY.x, MARY.z)), false);
  assert.equal(overlap(boxOf(CANDLE_RACKS[1].x, CANDLE_RACKS[1].z), boxOf(ROSE_ALTAR.x, ROSE_ALTAR.z)), false);
});

test("초 제단 앞에 서면 그 제단 번호 (양쪽 모두)", async () => {
  const { nearCandleRack } = await import("../src/lib/game/InteractionSystem.ts");
  assert.equal(nearCandleRack(CANDLE_RACKS[0].x + 1.0, CANDLE_RACKS[0].z), 0);
  assert.equal(nearCandleRack(CANDLE_RACKS[1].x - 1.0, CANDLE_RACKS[1].z), 1);
  assert.equal(nearCandleRack(0, 0), -1);
});

test("서버 오류 코드 → 안내 종류", async () => {
  const { lightErrorReason } = await import("../src/lib/wishes.ts");
  assert.equal(lightErrorReason({ code: "P0004" }), "tooSoon");
  assert.equal(lightErrorReason({ code: "P0005" }), "daily");
  assert.equal(lightErrorReason({ code: "P0006" }), "notInRoom");
  assert.equal(lightErrorReason({ code: "P0003" }), "banned");
  assert.equal(lightErrorReason({ code: "XX000" }), "error");
});

test("서버에 소원 초 SQL 이 없으면 '준비 안 됨' 안내", async () => {
  const { lightErrorReason } = await import("../src/lib/wishes.ts");
  assert.equal(lightErrorReason({ code: "PGRST202" }), "notReady");
  assert.equal(lightErrorReason({ code: "PGRST205" }), "notReady");
});
