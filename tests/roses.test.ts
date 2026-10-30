// 장미꽃 받기·바치기·뿌리기 로직
import { test } from "node:test";
import assert from "node:assert/strict";
import { MARY_SHELF_HALF, ROSE_LEN, RoseStore, ROSE_CAP, nearRoseAltar, offeringSpot, petalOffsets } from "../src/lib/game/roses.ts";
import { ALTAR, COLLIDER_BOXES, MARY, MARY_SHRINE, ROSE_ALTAR, SANCTUARY_Y, WALL_X } from "../src/lib/game/chapelLayout.ts";
import { collide } from "../src/lib/game/PlayerController.ts";

test("장미 제단: 오른쪽 측랑, 벽 안쪽, 충돌 상자 있음, 앞에 서서 받을 수 있음", () => {
  assert.ok(ROSE_ALTAR.x > 6 && ROSE_ALTAR.x + ROSE_ALTAR.depth / 2 < WALL_X, "오른쪽 측랑 벽 안");
  assert.ok(COLLIDER_BOXES.some((b) => b.x === ROSE_ALTAR.x && b.z === ROSE_ALTAR.z));
  // 제단 앞(신자석 쪽)으로 다가가 설 수 있는 위치에서 받기 가능
  const p = collide(ROSE_ALTAR.x - 1.0, ROSE_ALTAR.z);
  assert.ok(nearRoseAltar(p.x, p.z));
  assert.equal(nearRoseAltar(0, 0), false);
});

test("바친 꽃 자리: 성모상 발치 꽃 선반 위 앞쪽 반원, 제단 앞(+Z) 단 위, 서로 겹치지 않음", () => {
  const m = Array.from({ length: ROSE_CAP.mary }, (_, n) => offeringSpot("mary", n, n + 1));
  for (const s of m) {
    // 밑동과 꽃송이 모두 선반 위 (성모상 발치 반지름 0.35 밖, 선반 반폭 안)
    const ends = [
      [s.x, s.z],
      [s.x + Math.cos(s.yaw) * ROSE_LEN, s.z - Math.sin(s.yaw) * ROSE_LEN],
    ];
    for (const [x, z] of ends) {
      assert.ok(Math.abs(x - MARY.x) < MARY_SHELF_HALF && Math.abs(z - MARY.z) < MARY_SHELF_HALF, `선반 밖 (${x.toFixed(2)}, ${z.toFixed(2)})`);
    }
    const mid = Math.hypot((ends[0][0] + ends[1][0]) / 2 - MARY.x, (ends[0][1] + ends[1][1]) / 2 - MARY.z);
    assert.ok(mid > 0.38, `성모상 발치와 겹침 r=${mid.toFixed(2)}`);
    assert.ok((ends[0][0] + ends[1][0]) / 2 > MARY.x - 0.15, "앞쪽 반원");
    assert.ok(Math.abs(s.y - (MARY_SHRINE.pedestalH + 0.045)) < 1e-9);
  }
  // 서로 너무 가깝지 않음
  for (let i = 0; i < m.length; i++)
    for (let k = i + 1; k < m.length; k++) assert.ok(Math.hypot(m[i].x - m[k].x, m[i].z - m[k].z) > 0.025, `${i}·${k}`);
  const j = offeringSpot("jesus", 0, 3);
  assert.ok(j.z > ALTAR.z + ALTAR.depth / 2 && j.z < ALTAR.z + 2);
  // 꽃송이 끝도 제단 안으로 들어가지 않음 (사람 쪽 +Z 로 뻗음)
  assert.ok(j.z - Math.sin(j.yaw) * ROSE_LEN > ALTAR.z + ALTAR.depth / 2);
  assert.ok(Math.abs(j.y - (SANCTUARY_Y + 0.02)) < 1e-9);
});

test("꽃이 너무 많아지면 오래된 것부터 사라짐 (대상별 최대 개수)", () => {
  const store = new RoseStore();
  for (let i = 0; i < ROSE_CAP.mary + 5; i++) store.add("mary", i);
  for (let i = 0; i < 3; i++) store.add("floor", i, { x: 0, y: 0, z: 5 });
  const mary = store.all().filter((r) => r.target === "mary");
  assert.equal(mary.length, ROSE_CAP.mary);
  assert.equal(mary[0].seed, 5, "처음 5개가 지워짐");
  assert.equal(store.all().filter((r) => r.target === "floor").length, 3);
});

test("바닥 꽃잎: 같은 seed 면 모든 사람 화면에서 같은 모양, 사람 발밑 근처", () => {
  assert.deepEqual(petalOffsets(42), petalOffsets(42));
  assert.notDeepEqual(petalOffsets(42), petalOffsets(43));
  for (const p of petalOffsets(7)) assert.ok(Math.hypot(p.dx, p.dz) < 0.5);
});
