// 시간에 따라 바뀌는 조명
import { test } from "node:test";
import assert from "node:assert/strict";
import { hourOverride, koreaHour, moodAt, MOODS } from "../src/lib/timeOfDay.ts";

test("한국 시각: UTC + 9시간", () => {
  assert.equal(koreaHour(new Date("2026-10-30T16:30:00Z")), 1.5); // 한국 새벽 1:30
  assert.equal(koreaHour(new Date("2026-10-31T03:00:00Z")), 12);
});

test("한낮은 밝고, 새벽 1시는 어둡고 촛불이 더 밝음, 노을은 주황빛", () => {
  assert.deepEqual(moodAt(12), MOODS.DAY);
  assert.deepEqual(moodAt(1), MOODS.NIGHT);
  assert.ok(moodAt(1).hemi < moodAt(12).hemi);
  assert.ok(moodAt(1).candles > moodAt(12).candles);
  assert.deepEqual(moodAt(18.5), MOODS.DUSK);
});

test("시각 사이는 부드럽게 이어짐 (1분 차이에 큰 변화 없음)", () => {
  for (let h = 0; h < 24; h += 1 / 60) {
    const a = moodAt(h);
    const b = moodAt(h + 1 / 60);
    assert.ok(Math.abs(a.hemi - b.hemi) < 0.02, `h=${h.toFixed(2)}`);
    assert.ok(Math.abs(a.exposure - b.exposure) < 0.01);
  }
  assert.deepEqual(moodAt(24), moodAt(0));
});

test("?hour= 로 미리보기, 잘못된 값은 무시", () => {
  assert.equal(hourOverride("?hour=21"), 21);
  assert.equal(hourOverride("?hour=6.5"), 6.5);
  assert.equal(hourOverride("?hour=30"), null);
  assert.equal(hourOverride("?room=x"), null);
});
