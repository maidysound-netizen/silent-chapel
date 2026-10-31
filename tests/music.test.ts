// 성가 무작위 재생 순서
import { test } from "node:test";
import assert from "node:assert/strict";
import { MUSIC_TRACKS, shuffledOrder } from "../src/lib/music.ts";

test("섞인 순서: 모든 곡이 한 번씩, 매번 다른 순서가 나올 수 있음", () => {
  const n = MUSIC_TRACKS.length;
  const seen = new Set<string>();
  for (let k = 0; k < 50; k++) {
    const o = shuffledOrder(n);
    assert.deepEqual([...o].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i));
    seen.add(o.join(","));
  }
  assert.ok(seen.size > 5, "여러 가지 순서");
});

test("새 바퀴의 첫 곡은 방금 끝난 곡이 아님", () => {
  for (let last = 0; last < MUSIC_TRACKS.length; last++)
    for (let k = 0; k < 30; k++) assert.notEqual(shuffledOrder(MUSIC_TRACKS.length, Math.random, last)[0], last);
});
