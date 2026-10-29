"use client";
// 로컬 플레이어의 가변 상태. 매 프레임 바뀌므로 React 상태 대신 일반 객체로 둡니다.
import { createPlayerState, type PlayerState } from "@/lib/game/PlayerState";
import { SPAWN, type Seat, SEAT_BY_ID, floorHeight } from "@/lib/game/chapelLayout";
import { collide } from "@/lib/game/PlayerController";
import { findInteraction, findSeat } from "@/lib/game/InteractionSystem";
import { getNetworkManager } from "@/lib/net/NetworkManager";
import { useApp } from "./useAppStore";

export const localPlayer = {
  state: createPlayerState(SPAWN.x, SPAWN.z, SPAWN.yaw) as PlayerState,
  keys: { forward: 0, right: 0 },
  touch: { forward: 0, right: 0 },
  camera: { yaw: 0, pitch: 0.28, distance: 4.2 },
};

export function resetLocalPlayer() {
  localPlayer.state = createPlayerState(SPAWN.x, SPAWN.z, SPAWN.yaw);
  localPlayer.camera.yaw = SPAWN.yaw;
  localPlayer.camera.pitch = 0.28;
  useApp.getState().setPose("stand");
}

export function occupiedSeats(): Set<string> {
  return getNetworkManager().occupiedSeats();
}

export function sitAt(seat: Seat) {
  if (occupiedSeats().has(seat.id)) return;
  localPlayer.state = { ...localPlayer.state, x: seat.x, z: seat.z, y: 0, yaw: seat.yaw, moving: false, pose: "sit", seatId: seat.id };
  localPlayer.camera.yaw = seat.yaw;
  useApp.getState().setPose("sit");
}

export function standUp() {
  const s = localPlayer.state;
  if (s.pose !== "sit") return;
  const seat = s.seatId ? SEAT_BY_ID.get(s.seatId) : null;
  const p = seat ? collide(seat.standX, seat.standZ) : collide(s.x, s.z + 0.8);
  localPlayer.state = { ...s, x: p.x, z: p.z, y: floorHeight(p.z), moving: false, pose: "stand", seatId: null };
  useApp.getState().setPose("stand");
}

/** E 키 / 상호작용 버튼 */
export function interact() {
  const app = useApp.getState();
  const s = localPlayer.state;
  if (s.pose === "sit") return;
  const t = findInteraction(s.x, s.z, occupiedSeats());
  if (!t) return;
  if (t.kind === "rosary") app.openPanel("rosary");
  else if (t.kind === "bible") app.openPanel("bible");
  else sitAt(t.seat);
}

/** F 키 / 앉기·일어나기 버튼 */
export function toggleSit() {
  const s = localPlayer.state;
  if (s.pose === "sit") return standUp();
  const seat = findSeat(s.x, s.z, occupiedSeats());
  if (seat) sitAt(seat);
}
