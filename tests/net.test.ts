// 네트워크 메시지 검증 · 보간 · 재연결 · 충돌 테스트
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  encodeState,
  idTag,
  interpolationDelayMs,
  isValidNickname,
  sanitizeNickname,
  sendRateHz,
  validatePresenceMeta,
  validateGesture,
  validateState,
} from "../src/lib/net/protocol.ts";
import { SnapshotBuffer } from "../src/lib/net/PositionInterpolation.ts";
import { backoffDelayMs } from "../src/lib/net/ReconnectionHandler.ts";
import { isValidRoomId, roomFromLocation, roomTopic } from "../src/lib/net/RoomManager.ts";
import { collide, stepPlayer } from "../src/lib/game/PlayerController.ts";
import { createPlayerState, wrapAngle } from "../src/lib/game/PlayerState.ts";
import { COLLIDER_BOXES, SEATS } from "../src/lib/game/chapelLayout.ts";
import { findSeat } from "../src/lib/game/InteractionSystem.ts";

const UID = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";
const NOW = 1_800_000_000_000;

test("encode → validate 왕복", () => {
  const s = { ...createPlayerState(1.234, 2.345, 0.5), moving: true };
  const m = encodeState(UID, 5, s, NOW);
  assert.deepEqual(m.p, [1.23, 0, 2.35]);
  const v = validateState(JSON.parse(JSON.stringify(m)), NOW + 50);
  assert.ok(v);
  assert.equal(v.s, 5);
  assert.ok(JSON.stringify(m).length < 140, `메시지 크기 ${JSON.stringify(m).length}B`);
});

test("앉기 상태와 좌석 검증", () => {
  const seat = SEATS[3];
  const s = { ...createPlayerState(seat.x, seat.z, 0), pose: "sit" as const, seatId: seat.id };
  assert.equal(validateState(encodeState(UID, 1, s, NOW), NOW)?.c, seat.id);
  assert.equal(validateState({ ...encodeState(UID, 1, s, NOW), c: "X99-9" }, NOW), null);
});

test("잘못된 메시지는 버림", () => {
  const good = encodeState(UID, 1, createPlayerState(0, 0, 0), NOW);
  const bad: unknown[] = [
    null,
    "hi",
    { ...good, v: 2 },
    { ...good, u: "not-a-uuid" },
    { ...good, s: -1 },
    { ...good, s: 1.5 },
    { ...good, t: NOW + 120_000 },
    { ...good, t: NOW - 120_000 },
    { ...good, p: [0, 0] },
    { ...good, p: [Infinity, 0, 0] },
    { ...good, p: [500, 0, 0] },
    { ...good, r: "x" },
    { ...good, m: 2 },
    { ...good, a: 1, c: null },
    { ...good, extra: "x".repeat(400) },
  ];
  for (const b of bad) assert.equal(validateState(b, NOW), null, JSON.stringify(b)?.slice(0, 80));
});

test("닉네임 정리", () => {
  assert.equal(sanitizeNickname("  순례자  "), "순례자");
  assert.equal(sanitizeNickname("<script>alert(1)</script>"), "scriptalert1scri"); // 16자 제한
  assert.equal(sanitizeNickname("a\u0000b‮c"), "abc");
  assert.equal(sanitizeNickname("가".repeat(40)).length, 16);
  assert.ok(isValidNickname("Pilgrim 7"));
  assert.ok(!isValidNickname(""));
  assert.ok(!isValidNickname("<b>"));
  assert.equal(validatePresenceMeta({ n: "<b>", a: 0, c: null, j: 1 }), null);
  assert.equal(idTag(UID), "1B4E");
});

test("접속자 수에 따른 전송 주기: n²·Hz ≤ 예산", () => {
  assert.equal(sendRateHz(1), 10);
  assert.equal(sendRateHz(2), 10);
  for (const n of [3, 4, 5, 8]) assert.ok(n * n * sendRateHz(n) <= 80 + 1e-9, `n=${n}`);
  assert.equal(sendRateHz(10), 1, "최소 1Hz");
  assert.ok(interpolationDelayMs(10) >= 120);
  assert.ok(interpolationDelayMs(1) > interpolationDelayMs(10));
});

test("스냅샷 보간", () => {
  const b = new SnapshotBuffer();
  assert.equal(b.sample(0), null);
  b.push({ time: 1000, x: 0, y: 0, z: 0, yaw: 0 });
  b.push({ time: 1100, x: 1, y: 0, z: 2, yaw: 0 });
  const mid = b.sample(1050)!;
  assert.ok(Math.abs(mid.x - 0.5) < 1e-9 && Math.abs(mid.z - 1) < 1e-9);
  assert.equal(b.sample(500)!.x, 0, "이전 시점은 첫 위치");
  assert.equal(b.sample(5000)!.x, 1, "이후 시점은 마지막 위치(외삽 안 함)");
});

test("각도 보간은 짧은 쪽으로", () => {
  const b = new SnapshotBuffer();
  b.push({ time: 0, x: 0, y: 0, z: 0, yaw: 3.0 });
  b.push({ time: 100, x: 0, y: 0, z: 0, yaw: -3.0 });
  const y = b.sample(50)!.yaw;
  assert.ok(Math.abs(Math.abs(wrapAngle(y)) - Math.PI) < 0.01, `yaw=${y}`);
});

test("큰 순간이동은 보간하지 않음", () => {
  const b = new SnapshotBuffer();
  b.push({ time: 0, x: 0, y: 0, z: 0, yaw: 0 });
  b.push({ time: 100, x: 8, y: 0, z: 0, yaw: 0 });
  assert.equal(b.sample(50)!.x, 8);
});

test("재연결 백오프는 증가하고 상한이 있음", () => {
  assert.equal(backoffDelayMs(0, 1000, 30000, 1), 1000);
  assert.equal(backoffDelayMs(3, 1000, 30000, 1), 8000);
  assert.equal(backoffDelayMs(20, 1000, 30000, 1), 30000);
  assert.equal(backoffDelayMs(0, 1000, 30000, 0), 700);
});

test("Room ID", () => {
  assert.equal(roomTopic("main-chapel"), "room:main-chapel");
  assert.ok(!isValidRoomId("Main"));
  assert.ok(!isValidRoomId("a/b"));
  assert.throws(() => roomTopic("../x"));
  assert.equal(roomFromLocation("?room=quiet-2"), "quiet-2");
  assert.equal(roomFromLocation("?room=<x>"), "main-chapel");
});

test("충돌: 장의자/벽을 통과하지 못함", () => {
  const pew = COLLIDER_BOXES[0];
  const p = collide(pew.x, pew.z);
  const inside = Math.abs(p.x - pew.x) < pew.hx && Math.abs(p.z - pew.z) < pew.hz;
  assert.ok(!inside);
  const w = collide(100, 0);
  assert.ok(w.x <= 9.2);
});

test("이동: 앞으로 걸으면 -Z 로, 앉아 있으면 움직이지 않음", () => {
  const s0 = createPlayerState(0, 12, 0);
  const s1 = stepPlayer(s0, { forward: 1, right: 0 }, 0, 0.5);
  assert.ok(s1.z < s0.z && s1.moving);
  const sit = { ...s0, pose: "sit" as const };
  const s2 = stepPlayer(sit, { forward: 1, right: 0 }, 0, 0.5);
  assert.equal(s2.z, sit.z);
});

test("좌석 찾기: 가까운 빈 좌석, 점유 좌석 제외", () => {
  const seat = SEATS[5];
  assert.equal(findSeat(seat.standX, seat.standZ, new Set())?.id, seat.id);
  assert.notEqual(findSeat(seat.standX, seat.standZ, new Set([seat.id]))?.id, seat.id);
  assert.equal(findSeat(0, 14, new Set()), null);
});

test("절(bow) 제스처 메시지 검증", () => {
  const ok = { v: 1, u: UID, t: NOW, g: "bow" };
  assert.deepEqual(validateGesture(ok, NOW), ok);
  assert.equal(validateGesture({ ...ok, g: "dance" }, NOW), null);
  assert.equal(validateGesture({ ...ok, u: "x" }, NOW), null);
  assert.equal(validateGesture({ ...ok, t: NOW - 120_000 }, NOW), null);
});
