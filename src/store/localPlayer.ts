"use client";
// 로컬 플레이어의 가변 상태. 매 프레임 바뀌므로 React 상태 대신 일반 객체로 둡니다.
import { BOW_MS, createPlayerState, type PlayerState } from "@/lib/game/PlayerState";
import { CROSS_MS } from "@/lib/game/gestures";
import { nearRoseAltar } from "@/lib/game/roses";
import { ALTAR, CRUCIFIX, MARY, SPAWN, type Seat, SEAT_BY_ID, floorHeight } from "@/lib/game/chapelLayout";
import { collide } from "@/lib/game/PlayerController";
import { findInteraction, findSeat } from "@/lib/game/InteractionSystem";
import { getNetworkManager } from "@/lib/net/NetworkManager";
import { useApp } from "./useAppStore";

export const localPlayer = {
  state: createPlayerState(SPAWN.x, SPAWN.z, SPAWN.yaw) as PlayerState,
  keys: { forward: 0, right: 0 },
  touch: { forward: 0, right: 0 },
  /** 달리기 입력: Shift 키 / 모바일 달리기 버튼 (누르고 있는 동안) */
  run: { key: false, touch: false },
  camera: { yaw: 0, pitch: 0.28, distance: 4.2 },
  bow: { at: 0 },
  cross: { at: 0 },
  /** 묵상 시점에서 둘러본 정도 (십자가 방향 기준 오프셋, 라디안) */
  meditationLook: { yaw: 0, pitch: 0 },
};

export function resetLocalPlayer() {
  localPlayer.state = createPlayerState(SPAWN.x, SPAWN.z, SPAWN.yaw);
  localPlayer.camera.yaw = SPAWN.yaw;
  localPlayer.camera.pitch = 0.28;
  useApp.getState().setPose("stand");
  useApp.getState().setHoldingRose(false);
}

export function occupiedSeats(): Set<string> {
  return getNetworkManager().occupiedSeats();
}

export function sitAt(seat: Seat) {
  if (occupiedSeats().has(seat.id)) return;
  localPlayer.state = { ...localPlayer.state, x: seat.x, z: seat.z, y: 0, yaw: seat.yaw, moving: false, running: false, pose: "sit", seatId: seat.id };
  localPlayer.camera.yaw = seat.yaw;
  useApp.getState().setPose("sit");
}

export function standUp() {
  const s = localPlayer.state;
  if (s.pose !== "sit") return;
  const seat = s.seatId ? SEAT_BY_ID.get(s.seatId) : null;
  const p = seat ? collide(seat.standX, seat.standZ) : collide(s.x, s.z + 0.8);
  localPlayer.state = { ...s, x: p.x, z: p.z, y: floorHeight(p.z), moving: false, running: false, pose: "stand", seatId: null };
  useApp.getState().setPose("stand");
}

// ---------- 꽃 ----------

const newSeed = () => Math.floor(Math.random() * 1e9);

/** 꽃 제단에서 한 송이 받기 (flower: FLOWERS 번호, 없으면 마지막으로 고른 꽃) */
export function pickRose(flower?: number) {
  const app = useApp.getState();
  const s = localPlayer.state;
  if (app.holdingRose || s.pose !== "stand" || !nearRoseAltar(s.x, s.z)) return;
  const f = flower ?? app.heldFlower;
  app.setHeldFlower(f);
  app.setHoldingRose(true);
  getNetworkManager().sendRose("pick", 0, undefined, f);
}

/** 성모님(성모상 앞) 또는 예수님(제단 앞)께 바치기: 그쪽을 향해 돌아선 뒤 내려놓음 */
export function offerRose(target: "mary" | "jesus") {
  const app = useApp.getState();
  const s = localPlayer.state;
  if (!app.holdingRose || s.pose !== "stand") return;
  const [tx, tz] = target === "mary" ? [MARY.x, MARY.z] : [ALTAR.x, ALTAR.z];
  localPlayer.state = { ...s, yaw: yawToward(s, tx, tz) };
  const seed = newSeed();
  const net = getNetworkManager();
  const rec = net.roses.add(target, seed, undefined, app.heldFlower);
  net.sendRose(target, seed, undefined, app.heldFlower);
  void net.placeFlower(rec); // 12시간 동안 모두에게
  app.setHoldingRose(false);
}

/** 들고 있던 장미를 발 앞 바닥에 내려놓기 (어디서든): 꽃잎으로 뿌리기(G) 또는 꽃송이째 놓기(H) */
function dropRose(kind: "floor" | "floorRose") {
  const app = useApp.getState();
  const s = localPlayer.state;
  if (!app.holdingRose || s.pose !== "stand") return;
  // 바라보는 쪽(아바타 정면 = -Z 회전) 0.6m 앞
  const x = s.x - Math.sin(s.yaw) * 0.6;
  const z = s.z - Math.cos(s.yaw) * 0.6;
  const seed = newSeed();
  const net = getNetworkManager();
  const rec = net.roses.add(kind, seed, { x, y: floorHeight(z), z }, app.heldFlower);
  net.sendRose(kind, seed, { x, z }, app.heldFlower);
  void net.placeFlower(rec);
  app.setHoldingRose(false);
}
export const scatterRose = () => dropRose("floor");
export const placeRoseOnFloor = () => dropRose("floorRose");

/** 내 주변 바닥의 꽃잎·꽃송이 치우기 (남이 놓은 것도) */
export function sweepRoses() {
  const s = localPlayer.state;
  if (s.pose !== "stand") return;
  const net = getNetworkManager();
  if (net.roses.sweep(s.x, s.z) > 0) {
    net.sendRose("sweep", 0, { x: s.x, z: s.z });
    void net.sweepFlowers(s.x, s.z);
  }
}

/** E 키 / 상호작용 버튼 */
export function interact() {
  const app = useApp.getState();
  const s = localPlayer.state;
  if (s.pose === "sit") return;
  // 꽃: 들고 있으면 성모상·제단 앞에서 바치기, 없으면 꽃 제단에서 (마지막으로 고른) 꽃 받기
  if (app.holdingRose) {
    if (app.nearMary) return offerRose("mary");
    if (app.nearJesus) return offerRose("jesus");
  } else if (nearRoseAltar(s.x, s.z)) {
    return pickRose();
  }
  const t = findInteraction(s.x, s.z, occupiedSeats());
  if (!t) return;
  if (t.kind === "rosary") app.openPanel("rosary");
  else if (t.kind === "candles") app.openPanel("wishes");
  else if (t.kind === "bible") app.openPanel("bible");
  else sitAt(t.seat);
}

export const MARY_BOW_RADIUS = 3.5;

export function isNearMary(x: number, z: number): boolean {
  return Math.hypot(MARY.x - x, MARY.z - z) < MARY_BOW_RADIUS;
}

export function isBowing(now = Date.now()): boolean {
  return now - localPlayer.bow.at < BOW_MS;
}

/** 제단 앞(장의자와 제단 사이)에 서 있는지 — 예수님(십자가)께 절하기 안내 */
export function isNearJesus(x: number, z: number): boolean {
  return Math.abs(x - ALTAR.x) < 4.5 && z < -9.3 && z > ALTAR.z + 1;
}

/** 아바타가 (tx, tz)를 바라보는 yaw (아바타 정면은 -Z) */
function yawToward(s: PlayerState, tx: number, tz: number) {
  return Math.atan2(-(tx - s.x), -(tz - s.z));
}

/** B 키 / 절하기 버튼. 어디서든 지금 바라보는 방향으로 절하고,
 *  성모상 가까이면 성모님을, 제단 앞이면 십자가(예수님)를 향해 돌아선 뒤 절합니다 */
export function bow() {
  const now = Date.now();
  if (isBowing(now)) return;
  const s = localPlayer.state;
  if (s.pose === "stand") {
    if (isNearMary(s.x, s.z)) localPlayer.state = { ...s, yaw: yawToward(s, MARY.x, MARY.z) };
    else if (isNearJesus(s.x, s.z)) localPlayer.state = { ...s, yaw: yawToward(s, CRUCIFIX.x, CRUCIFIX.z) };
  }
  localPlayer.bow.at = now;
  getNetworkManager().sendGesture("bow");
}

/** C 키 / 성호 버튼: 서 있든 앉아 있든 그 자리에서 성호를 그음 */
export function signCross() {
  const now = Date.now();
  if (now - localPlayer.cross.at < CROSS_MS) return;
  localPlayer.cross.at = now;
  getNetworkManager().sendGesture("cross");
}

/** F 키 / 앉기·일어나기 버튼 */
export function toggleSit() {
  const s = localPlayer.state;
  if (s.pose === "sit") return standUp();
  const seat = findSeat(s.x, s.z, occupiedSeats());
  if (seat) sitAt(seat);
}
