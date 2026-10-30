// 소원 초: 글 검사, 하루 지나면 안 보임, 초 자리
import { test } from "node:test";
import assert from "node:assert/strict";
import { activeWishes, candleSlot, isValidWish, randomWishColor, sanitizeWish, WISH_COLORS, WISH_MAX, WISH_SLOTS, WISH_TTL_MS } from "../src/lib/wishes.ts";
import { CANDLE_RACK, COLLIDER_BOXES, MARY } from "../src/lib/game/chapelLayout.ts";

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

test("초 자리: 48개가 제단 위에 겹치지 않게, 성모 공간과 안 겹침", () => {
  assert.equal(WISH_SLOTS, 48);
  const slots = Array.from({ length: WISH_SLOTS }, (_, i) => candleSlot(i));
  for (const s of slots) {
    assert.ok(Math.abs(s.z - CANDLE_RACK.z) < CANDLE_RACK.width / 2, `z=${s.z}`);
    assert.ok(Math.abs(s.x - CANDLE_RACK.x) < CANDLE_RACK.depth / 2);
  }
  for (let i = 0; i < slots.length; i++)
    for (let k = i + 1; k < slots.length; k++) assert.ok(Math.hypot(slots[i].x - slots[k].x, slots[i].z - slots[k].z) > 0.1, `${i}·${k}`);
  // 성모상 꽃 선반 충돌 상자와 초 제단 충돌 상자가 겹치지 않음
  const rack = COLLIDER_BOXES.find((b) => b.x === CANDLE_RACK.x && b.z === CANDLE_RACK.z)!;
  const mary = COLLIDER_BOXES.find((b) => b.x === MARY.x && b.z === MARY.z)!;
  assert.ok(rack.z - rack.hz >= mary.z + mary.hz - 1e-9 || Math.abs(rack.x - mary.x) >= rack.hx + mary.hx);
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
