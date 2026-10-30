// 십자가상·성모상(Meshy GLB) 배치: 충돌 상자, 시선 높이, 웹용 파일 크기
import { test } from "node:test";
import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { createPlayerState } from "../src/lib/game/PlayerState.ts";
import { stepPlayer } from "../src/lib/game/PlayerController.ts";
import { MOVE_CONFIG } from "../src/lib/game/avatarConfig.ts";
import { ALTAR, APSE_Z, COLLIDER_BOXES, CRUCIFIX, KNEELER, MARY, MARY_SHRINE, SANCTUARY_Y } from "../src/lib/game/chapelLayout.ts";

const walk = (x: number, z: number, forward: number, right: number, steps = 240) => {
  let s = createPlayerState(x, z, 0);
  for (let i = 0; i < steps; i++) s = stepPlayer(s, { forward, right }, 0, 1 / 30);
  return s;
};

test("십자가상: 받침이 제단 단 바닥에 닿고, 제단과 뒷벽 사이에 들어감", () => {
  assert.equal(CRUCIFIX.y, SANCTUARY_Y);
  // 받침 앞뒤(모델 기준 약 -0.96 ~ +0.95m)가 뒷벽과 제단을 침범하지 않음
  assert.ok(CRUCIFIX.z - 0.96 > APSE_Z, "뒷벽 안쪽");
  assert.ok(CRUCIFIX.z + 0.95 < ALTAR.z - ALTAR.depth / 2, "제단 뒤");
  // 시선·조명 목표가 십자가상 높이 안
  assert.ok(CRUCIFIX.focusY > CRUCIFIX.y + 3 && CRUCIFIX.focusY < CRUCIFIX.y + CRUCIFIX.height);
});

test("십자가상: 옆에서 걸어 들어가도 받침을 뚫지 못함", () => {
  // 제단 옆(x=3)에서 받침 쪽(-X)으로
  const s = walk(3, CRUCIFIX.z - 0.3, 0, -1);
  const box = COLLIDER_BOXES.find((b) => b.x === CRUCIFIX.x && b.top === CRUCIFIX.y + CRUCIFIX.height)!;
  assert.ok(box, "십자가상 충돌 상자");
  assert.ok(s.x >= box.hx + MOVE_CONFIG.radius - 1e-6, `x=${s.x.toFixed(3)}`);
});

test("성모상: 받침대를 뚫지 못하고, 무릎틀 자리까지는 걸어갈 수 있음", () => {
  // 성모상 옆(-Z 쪽)에서 성모상을 향해 곧장 걸어감 (무릎틀은 +X 쪽이라 가로막지 않음)
  const box = COLLIDER_BOXES.find((b) => b.x === MARY.x && b.z === MARY.z)!;
  const s = walk(MARY.x, MARY.z - 1.6, -1, 0);
  assert.ok(s.z <= MARY.z - box.hz - MOVE_CONFIG.radius + 1e-6, `z=${s.z.toFixed(3)}`);
  assert.equal(box.top, MARY_SHRINE.pedestalH + MARY_SHRINE.statueH);
  // 무릎틀 바로 앞(+X 쪽)은 막혀 있지 않음
  const k = walk(-5.5, KNEELER.z, 0, -1, 25);
  assert.ok(k.x < -6.3, `무릎틀 앞까지 x=${k.x.toFixed(2)}`);
});

test("웹용 GLB는 모바일용으로 작게 (각 2MB 이하), 원본은 object/ 에 그대로", () => {
  for (const f of ["crucifix", "mary"]) {
    const size = statSync(`public/models/chapel/${f}.glb`).size;
    assert.ok(size < 2_000_000, `${f}.glb ${size} bytes`);
  }
});
