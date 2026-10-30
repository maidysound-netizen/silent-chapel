// 아바타 애니메이션 상태 · 달리기 · 카메라 충돌 · 애니메이션 동기화 테스트
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANIM_STATES,
  animCode,
  animFromCode,
  deriveAnimState,
  MOVE_CONFIG,
  resolveAnimState,
  type AnimState,
} from "../src/lib/game/avatarConfig.ts";
import { createPlayerState } from "../src/lib/game/PlayerState.ts";
import { stepPlayer } from "../src/lib/game/PlayerController.ts";
import { cameraFreeFraction } from "../src/lib/game/cameraCollision.ts";
import { animOf, encodeState, validateState } from "../src/lib/net/protocol.ts";

const UID = "11111111-2222-3333-4444-555555555555";

test("애니메이션 상태: 자세·이동·달리기에서 결정", () => {
  assert.equal(deriveAnimState({ pose: "stand", moving: false }), "idle");
  assert.equal(deriveAnimState({ pose: "stand", moving: true, running: false }), "walk");
  assert.equal(deriveAnimState({ pose: "stand", moving: true, running: true }), "run");
  assert.equal(deriveAnimState({ pose: "stand", moving: false, running: true }), "idle", "멈추면 달리기 버튼을 눌러도 idle");
  assert.equal(deriveAnimState({ pose: "sit", moving: false }), "sit");
  // 앞으로 추가할 자세
  assert.equal(deriveAnimState({ pose: "kneel", moving: false }), "kneel");
  assert.equal(deriveAnimState({ pose: "pray", moving: false }), "pray");
});

test("없는 클립은 대체 상태로: Run→Walk→Idle, Pray→Kneel→Idle", () => {
  const only = (...have: AnimState[]) => (s: AnimState) => have.includes(s);
  assert.equal(resolveAnimState("run", only("idle", "walk", "run")), "run");
  assert.equal(resolveAnimState("run", only("idle", "walk")), "walk");
  assert.equal(resolveAnimState("run", only("idle")), "idle");
  assert.equal(resolveAnimState("pray", only("idle", "kneel")), "kneel");
  assert.equal(resolveAnimState("pray", only("idle")), "idle");
  assert.equal(resolveAnimState("sit", only()), null);
});

test("애니메이션 네트워크 코드: 왕복 변환, 잘못된 코드는 거부", () => {
  for (const s of ANIM_STATES) assert.equal(animFromCode(animCode(s)), s);
  for (const bad of [-1, ANIM_STATES.length, 1.5, "1", null, undefined, NaN]) assert.equal(animFromCode(bad), null);
});

test("달리기: 같은 입력이면 걷기보다 runSpeed/walkSpeed 배만큼 더 감", () => {
  const start = createPlayerState(0, 12, 0);
  const dt = 0.1;
  const walk = stepPlayer(start, { forward: 1, right: 0 }, 0, dt);
  const run = stepPlayer(start, { forward: 1, right: 0, run: true }, 0, dt);
  const dWalk = start.z - walk.z;
  const dRun = start.z - run.z;
  assert.ok(Math.abs(dWalk - MOVE_CONFIG.walkSpeed * dt) < 1e-9);
  assert.ok(Math.abs(dRun - MOVE_CONFIG.runSpeed * dt) < 1e-9);
  assert.equal(walk.running, false);
  assert.equal(run.running, true);
  // 멈추면 running 해제
  assert.equal(stepPlayer(run, { forward: 0, right: 0, run: true }, 0, dt).running, false);
});

test("달리기 중에도 충돌 유지: 기둥을 뚫지 못함", () => {
  // 기둥 (6, 0) 반지름 0.55 쪽으로 오래 달리기
  let s = { ...createPlayerState(3, 0, 0), x: 3 };
  for (let i = 0; i < 200; i++) s = stepPlayer(s, { forward: 0, right: 1, run: true }, 0, 1 / 30);
  const d = Math.hypot(s.x - 6, s.z - 0);
  assert.ok(d >= 0.55 + MOVE_CONFIG.radius - 1e-6, `기둥 중심까지 ${d.toFixed(3)}m`);
});

test("카메라 충돌: 기둥이 사이에 있으면 앞에서 멈춤, 트여 있으면 그대로", () => {
  // 머리(4, 1.5, 0) → 카메라(8, 1.8, 0): 기둥 (6, 0) 이 가로막음
  const blocked = cameraFreeFraction({ x: 4, y: 1.5, z: 0 }, { x: 8, y: 1.8, z: 0 });
  assert.ok(blocked < 0.5, `막힘 비율 ${blocked}`);
  // 통로 한가운데 → 뒤로 4m: 막힘 없음
  assert.equal(cameraFreeFraction({ x: 0, y: 1.5, z: 12 }, { x: 0, y: 2.6, z: 14.5 }), 1);
});

test("카메라 충돌: 낮은 장의자 위로는 지나가고, 등받이 높이 아래로는 못 지나감", () => {
  // 앞줄 장의자 (x≈2.95, z=-8) 위를 지나 높이 비추는 카메라
  const high = cameraFreeFraction({ x: 2.95, y: 1.5, z: -6.4 }, { x: 2.95, y: 2.6, z: -9.6 });
  assert.equal(high, 1);
  // 같은 방향인데 낮게 (0.7m) → 장의자에서 막힘
  const low = cameraFreeFraction({ x: 2.95, y: 0.8, z: -6.4 }, { x: 2.95, y: 0.7, z: -9.6 });
  assert.ok(low < 1, `낮은 카메라 비율 ${low}`);
});

test("애니메이션 동기화: 달리는 상태가 메시지로 전달되고, 예전 클라이언트(k 없음)도 받아들임", () => {
  const now = Date.now();
  const running = { ...createPlayerState(0, 5, 0), moving: true, running: true };
  const msg = encodeState(UID, 1, running, now);
  assert.equal(msg.k, animCode("run"));
  const v = validateState(JSON.parse(JSON.stringify(msg)), now);
  assert.ok(v);
  assert.equal(animOf(v!), "run");

  const old = { ...msg } as Record<string, unknown>;
  delete old.k;
  const v2 = validateState(old, now);
  assert.ok(v2, "k 가 없는 예전 메시지도 유효");
  assert.equal(animOf(v2!), "walk", "k 가 없으면 이동 중 → walk 로 추정");
});

test("애니메이션 동기화: 잘못된 k 는 거부, 자세와 모순되면 자세를 믿음", () => {
  const now = Date.now();
  const base = encodeState(UID, 1, { ...createPlayerState(0, 5, 0), moving: true, running: false }, now);
  assert.equal(validateState({ ...base, k: 99 }, now), null);
  assert.equal(validateState({ ...base, k: "run" }, now), null);
  // 멈춰 있는데 run 이라고 보내면 idle
  const stopped = validateState({ ...base, m: 0, k: animCode("run") }, now)!;
  assert.equal(animOf(stopped), "idle");
});

test("카메라 충돌: 기둥에 바짝 붙어 서도 카메라가 기둥 안으로 들어가지 않음", () => {
  // 실제 브라우저 확인에서 찾은 경우: 플레이어 x=4.9 (기둥 표면 x=5.45), 카메라를 기둥 쪽으로
  const target = { x: 4.9, y: 1.5, z: 0 };
  const desired = { x: 4.9 + 4.2, y: 2.1, z: 0 };
  const t = cameraFreeFraction(target, desired);
  const camX = target.x + (desired.x - target.x) * t;
  assert.ok(camX <= 6 - 0.55, `카메라 x=${camX.toFixed(3)} 는 기둥 표면(5.45) 앞이어야 함`);
});
