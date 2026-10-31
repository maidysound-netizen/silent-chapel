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

test("바친 꽃 자리: 성모상 발치 꽃 선반 위 앞쪽 반원, 서로 겹치지 않음", () => {
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

test("바닥 꽃 치우기: 근처의 꽃잎·꽃송이만 치우고, 바친 꽃과 멀리 있는 꽃은 그대로", () => {
  const store = new RoseStore();
  store.add("floor", 1, { x: 0, y: 0, z: 0 });
  store.add("floorRose", 2, { x: 0.8, y: 0, z: 0.5 });
  store.add("floorRose", 3, { x: 5, y: 0, z: 5 });
  store.add("mary", 4);
  assert.equal(store.hasFloorNear(0, 0), true);
  assert.equal(store.sweep(0, 0), 2);
  assert.deepEqual(store.all().map((r) => r.target).sort(), ["floorRose", "mary"]);
  assert.equal(store.hasFloorNear(0, 0), false);
  assert.equal(store.sweep(0, 0), 0);
});

test("예수님께 바친 꽃: 제단(책상) 위 가운데에 꽃더미로 소복이 쌓임", async () => {
  const { ALTAR_TOP_Y, JESUS_LAYERS } = await import("../src/lib/game/roses.ts");
  assert.equal(JESUS_LAYERS.reduce((a, b) => a + b, 0), ROSE_CAP.jesus);
  const spots = Array.from({ length: ROSE_CAP.jesus }, (_, n) => offeringSpot("jesus", n, n + 7));
  const front = ALTAR.z + ALTAR.depth / 2;
  for (const s of spots) {
    // 밑동과 꽃송이 끝 모두 제단 위 (가장자리 밖으로 크게 벗어나지 않음)
    const tipX = s.x + Math.cos(s.yaw) * ROSE_LEN;
    const tipZ = s.z - Math.sin(s.yaw) * ROSE_LEN;
    for (const [x, z] of [[s.x, s.z], [tipX, tipZ]]) {
      assert.ok(Math.abs(x - ALTAR.x) < ALTAR.width / 2, `x=${x.toFixed(2)}`);
      assert.ok(z < front + 0.12 && z > ALTAR.z - ALTAR.depth / 2, `z=${z.toFixed(2)}`);
    }
    assert.ok(s.y >= ALTAR_TOP_Y - 0.01);
  }
  // 위층일수록 높고, 가운데로 모임 (아래층 평균 퍼짐 > 맨 위층)
  const first = spots.slice(0, JESUS_LAYERS[0]);
  const top = spots.slice(-JESUS_LAYERS[JESUS_LAYERS.length - 1]);
  const avgY = (l: typeof spots) => l.reduce((a, s) => a + s.y, 0) / l.length;
  const spread = (l: typeof spots) => l.reduce((a, s) => a + Math.abs(s.x + Math.cos(s.yaw) * ROSE_LEN / 2 - ALTAR.x), 0) / l.length;
  assert.ok(avgY(top) > avgY(first) + 0.08, "위층이 높음");
  assert.ok(spread(top) < spread(first), "위층이 가운데로 모임");
});

test("꽃 종류: 여섯 가지, 모양·색이 있고 번호 검사", async () => {
  const { FLOWERS, isFlower } = await import("../src/lib/game/roses.ts");
  assert.equal(FLOWERS.length, 6);
  assert.deepEqual([...new Set(FLOWERS.map((f) => f.shape))].sort(), ["daisy", "lily", "rose", "tulip"]);
  assert.equal(isFlower(5), true);
  assert.equal(isFlower(6), false);
  assert.equal(isFlower(1.5), false);
});

test("12시간 저장: 서버 목록으로 바꿔도 방금 놓은 내 꽃은 남고, 오래된 알림은 서버 목록으로 대체", async () => {
  const { RoseStore, FLOWER_TTL_MS } = await import("../src/lib/game/roses.ts");
  const store = new RoseStore();
  const now = Date.now();
  store.add("mary", 1, undefined, 3, "local", now); // 내가 막 놓음 (저장 대기)
  store.add("jesus", 2, undefined, 0, "remote", now - 10_000); // 10초 전에 받은 남의 알림
  store.replaceFromServer([{ id: 100, target: "jesus", flower: 4, seed: 2, createdAt: now - 9_000 }], now);
  const all = store.all(now);
  assert.equal(all.filter((r) => r.target === "mary").length, 1, "내 꽃 유지");
  assert.deepEqual(all.filter((r) => r.target === "jesus").map((r) => r.id), [100], "알림은 서버 줄로 바뀜");
  // 12시간이 지나면 보이지 않음
  assert.equal(store.all(now + FLOWER_TTL_MS + 1).length, 0);
});

test("바친 꽃 자리는 놓인 순서로 정해져 누구 화면에서나 같음", async () => {
  const { RoseStore } = await import("../src/lib/game/roses.ts");
  const rows = [3, 1, 2].map((k) => ({ id: k, target: "jesus" as const, flower: k % 6, seed: k * 11, createdAt: 1_000 + k }));
  const a = new RoseStore();
  const b = new RoseStore();
  a.replaceFromServer(rows, 0);
  b.replaceFromServer([...rows].reverse(), 0);
  const pos = (s: InstanceType<typeof RoseStore>) => s.all(2_000).map((r) => [r.id, r.x.toFixed(3), r.y.toFixed(3), r.z.toFixed(3)].join());
  assert.deepEqual(pos(a), pos(b));
});
