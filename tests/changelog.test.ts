// 업데이트 소식
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHANGELOG, hasUnseen } from "../src/lib/changelog.ts";

test("소식: id 가 겹치지 않고, 세 언어 모두 적혀 있음", () => {
  assert.equal(new Set(CHANGELOG.map((c) => c.id)).size, CHANGELOG.length);
  for (const c of CHANGELOG) for (const l of ["ko", "en", "ja"] as const) assert.ok(c.text[l].length > 5, `${c.id} ${l}`);
});

test("새 소식 점: 맨 위 소식을 봤으면 사라짐", () => {
  assert.equal(hasUnseen(null), true);
  assert.equal(hasUnseen("오래된-id"), true);
  assert.equal(hasUnseen(CHANGELOG[0].id), false);
});
