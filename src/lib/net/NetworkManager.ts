// 실시간 멀티플레이 총괄.
//   인증(익명) → 방 입장 RPC → Realtime 채널 구독 → Presence(누가 있나) + Broadcast(위치/상태)
//
// 이 성당 MVP는 '클라이언트 권위' 구조입니다. 각 브라우저가 자기 위치를 정해 알리고, 서버는 중계만 합니다.
// 서버가 위치를 검증하지 않으므로 경쟁 게임(FPS)에는 그대로 쓰면 안 됩니다. docs/FPS_MULTIPLAYER_GUIDE.md 참고.

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { PlayerState, Pose } from "../game/PlayerState.ts";
import { SEAT_BY_ID, floorHeight } from "../game/chapelLayout.ts";
import type { AnimState } from "../game/avatarConfig.ts";
import {
  encodeState,
  idTag,
  interpolationDelayMs,
  animOf,
  poseOf,
  sendRateHz,
  validateGesture,
  validateModeration,
  validateRose,
  validateState,
  PROTOCOL_VERSION,
  type Gesture,
  type GestureMessage,
  type ModerationMessage,
  type RoseMessage,
  type PresenceMeta,
} from "./protocol.ts";
import { SnapshotBuffer } from "./PositionInterpolation.ts";
import { PresenceManager } from "./PresenceManager.ts";
import { ReconnectionHandler } from "./ReconnectionHandler.ts";
import { roomCandidates, roomTopic } from "./RoomManager.ts";
import { isFlower, RoseStore, ROSE_MIN_INTERVAL_MS, type FlowerRecord, type RoseTarget } from "../game/roses.ts";
import { isValidWish, lightErrorReason, WishStore, type LightResult, type WishCandle } from "../wishes.ts";
import { getSupabase, readSupabaseEnv, type SupabaseEnv } from "./supabaseClient.ts";

export type NetStatus = "disabled" | "idle" | "auth" | "connecting" | "connected" | "reconnecting" | "offline" | "error" | "full" | "banned";

export interface RemotePlayer {
  uid: string;
  nick: string;
  tag: string;
  buffer: SnapshotBuffer;
  lastSeq: number;
  lastHeard: number;
  pose: Pose;
  seatId: string | null;
  moving: boolean;
  /** 애니메이션 상태 (idle/walk/run/sit…), 아바타가 매 프레임 읽음 */
  anim: AnimState;
  /** Presence에 있는지 (없으면 곧 제거) */
  present: boolean;
  /** 절 동작 시작 시각 (아바타가 매 프레임 읽음) */
  bow: { at: number };
  /** 성호 긋기 시작 시각 */
  cross: { at: number };
  /** 꽃을 들고 있는지 (아바타가 매 프레임 읽음) */
  holdingRose: boolean;
  /** 들고 있는 꽃 종류 (FLOWERS 번호) */
  heldFlower: number;
  /** 마지막 장미 알림 시각 (도배 방지) */
  lastRoseAt: number;
}

export interface NetMetrics {
  sentTotal: number;
  recvTotal: number;
  sentBytes: number;
  recvBytes: number;
  sentPerSec: number;
  recvPerSec: number;
  droppedInvalid: number;
  droppedStale: number;
  /** 보낸 시각 → 받은 시각 차이의 중앙값(ms). 기기 간 시계 차이가 포함될 수 있음 */
  latencyMs: number | null;
  sendHz: number;
  reconnects: number;
}

export interface NetSnapshot {
  status: NetStatus;
  error: string | null;
  uid: string | null;
  roomId: string | null;
  /** 나를 포함한 접속자 수 */
  count: number;
  /** 관리자(내보내기 가능) 여부 — 서버 is_admin() 결과 */
  isAdmin: boolean;
  others: { uid: string; nick: string; tag: string; pose: Pose }[];
}

const IDLE_RESEND_MS = 20_000;
const STALE_REMOVE_MS = 12_000;
const EVENT_STATE = "st";
const EVENT_GESTURE = "gs";
const EVENT_MODERATION = "md";
const EVENT_ROSE = "rs";
/** 소원 초가 켜지거나 꺼졌다는 알림 → 받은 쪽은 서버에서 목록을 다시 읽음 */
const EVENT_WISH = "wc";
const WISH_REFRESH_MS = 60_000;
/** 같은 사람의 제스처는 이 간격보다 자주 받지 않음 (도배 방지) */
const GESTURE_MIN_MS = 2000;
/** 방에 아직 있다고 DB에 알리는 주기. join_room 의 정원 계산이 이 기록을 봅니다 */
const HEARTBEAT_MS = 30_000;

type RpcError = { code?: string; message?: string };
const isRoomFull = (e: RpcError) => e.code === "P0001" || /room is full/i.test(e.message ?? "");
const isRoomMissing = (e: RpcError) => e.code === "P0002" || /room not found/i.test(e.message ?? "");
const isBannedError = (e: RpcError) => e.code === "P0003" || /^banned$/i.test(e.message ?? "");

export class NetworkManager {
  private sb: SupabaseClient | null;
  private env: SupabaseEnv | null;
  private channel: RealtimeChannel | null = null;
  private presence: PresenceManager | null = null;
  private reconnector: ReconnectionHandler | null = null;
  private listeners = new Set<() => void>();
  private snapshot: NetSnapshot = { status: "disabled", error: null, uid: null, roomId: null, count: 1, isAdmin: false, others: [] };
  private nickname = "";
  private seq = 0;
  private lastSentAt = 0;
  private lastSent: PlayerState | null = null;
  private local: PlayerState | null = null;
  private joinedAt = 0;
  private wantConnected = false;
  /** 연결 시도 번호. 더 새로운 시도나 disconnect가 생기면 이전 시도는 중간에 멈춥니다 */
  private generation = 0;
  private lastHeartbeat = 0;
  /** 서버에서 차단이 확인된 사람 (이 세션 동안 숨김) */
  private readonly banned = new Set<string>();
  private janitor: ReturnType<typeof setInterval> | null = null;
  private latencySamples: number[] = [];
  private rateWindow = { sent: 0, recv: 0, at: 0 };

  readonly remotes = new Map<string, RemotePlayer>();
  /** 꽃 (서버 flower_offerings 12시간 + 아직 저장되지 않은 꽃) */
  readonly roses = new RoseStore();
  private lastFlowerLoad = 0;
  private flowerReload: ReturnType<typeof setTimeout> | null = null;
  /** 소원 초 (서버 wish_candles, 12시간 동안) */
  readonly wishes = new WishStore();
  private lastWishLoad = 0;
  private wishReload: ReturnType<typeof setTimeout> | null = null;
  readonly metrics: NetMetrics = {
    sentTotal: 0,
    recvTotal: 0,
    sentBytes: 0,
    recvBytes: 0,
    sentPerSec: 0,
    recvPerSec: 0,
    droppedInvalid: 0,
    droppedStale: 0,
    latencyMs: null,
    sendHz: 10,
    reconnects: 0,
  };

  /** sb/env 를 주입할 수 있어 테스트에서 가짜 Realtime 서버로 로직을 검증할 수 있습니다 */
  constructor(sb: SupabaseClient | null = getSupabase(), env: SupabaseEnv | null = readSupabaseEnv()) {
    this.sb = sb;
    this.env = sb ? env : null;
    if (this.sb) this.snapshot = { ...this.snapshot, status: "idle" };
  }

  get enabled(): boolean {
    return this.sb !== null;
  }

  // ---------- 구독 (UI용) ----------
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  getSnapshot = (): NetSnapshot => this.snapshot;
  private emit(patch: Partial<NetSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  // ---------- 연결 ----------
  async connect(roomId: string, nickname: string): Promise<void> {
    if (!this.sb || !this.env) return;
    this.wantConnected = true;
    this.nickname = nickname;
    this.joinedAt = Date.now();
    this.emit({ roomId, error: null });
    this.reconnector?.dispose();
    this.reconnector = new ReconnectionHandler(() => this.openChannel());
    if (typeof window !== "undefined") window.addEventListener("offline", this.onOffline);
    if (!this.janitor) this.janitor = setInterval(() => this.cleanup(), 1000);
    try {
      await this.openChannel();
    } catch (e) {
      // 모든 방이 가득 찬 경우는 openChannel 이 이미 "full" 로 알렸으므로 그대로 둠
      if (this.snapshot.status !== "full") this.emit({ status: "error", error: errorText(e) });
      this.reconnector.schedule();
    }
  }

  private onOffline = () => {
    if (!this.wantConnected) return;
    this.emit({ status: "offline" });
    this.teardownChannel();
    this.reconnector?.schedule(); // online 이벤트를 기다렸다가 즉시 재시도
  };

  private async ensureAuth(): Promise<string> {
    const sb = this.sb!;
    const { data } = await sb.auth.getSession();
    if (data.session?.user) return data.session.user.id;
    this.emit({ status: "auth" });
    // 익명 로그인: 계정 생성 없이 서버가 고유 user id를 발급합니다 (Supabase 대시보드에서 활성화 필요)
    const { data: signed, error } = await sb.auth.signInAnonymously();
    if (error || !signed.user) throw new Error(`익명 로그인 실패: ${error?.message ?? "unknown"}`);
    return signed.user.id;
  }

  private async openChannel(): Promise<void> {
    if (!this.wantConnected || !this.sb || !this.env) return;
    const gen = ++this.generation;
    const stale = () => gen !== this.generation || !this.wantConnected;
    let roomId = this.snapshot.roomId!;
    this.teardownChannel();
    this.emit({ status: this.metrics.reconnects > 0 || this.snapshot.uid ? "reconnecting" : "connecting" });

    const uid = await this.ensureAuth();
    if (stale()) return;
    this.emit({ uid });

    if (this.env.privateChannels) {
      // DB 함수가 방 존재 여부와 닉네임을 검증하고 visitor_sessions 행을 만듭니다.
      // Realtime 권한 정책(RLS)은 이 행이 있는 사용자만 채널에 들어오게 합니다.
      // 정원(10명)이 찼으면 다음 방으로. 아직 만들지 않은 방(room not found)도 건너뜁니다.
      let joined: string | null = null;
      for (const candidate of roomCandidates(roomId)) {
        const { error } = await this.sb.rpc("join_room", { p_room_id: candidate, p_nickname: this.nickname });
        if (stale()) return;
        if (!error) {
          joined = candidate;
          break;
        }
        if (isBannedError(error)) {
          this.onBannedSelf();
          return;
        }
        if (!isRoomFull(error) && !isRoomMissing(error)) throw new Error(`방 입장 실패(join_room): ${error.message}`);
      }
      if (!joined) {
        this.emit({ status: "full", error: "all rooms are full" });
        throw new Error("모든 방이 가득 찼습니다");
      }
      if (joined !== roomId) {
        roomId = joined;
        this.emit({ roomId });
      }
      this.lastHeartbeat = Date.now();
      void this.refreshAdmin();
      await this.sb.realtime.setAuth();
      if (stale()) return;
    }

    const channel = this.sb.channel(roomTopic(roomId), {
      config: {
        private: this.env.privateChannels,
        broadcast: { self: false, ack: false },
        presence: { key: uid },
      },
    });
    this.channel = channel;
    const presence = new PresenceManager(channel);
    this.presence = presence;

    channel
      .on("broadcast", { event: EVENT_STATE }, ({ payload }) => this.onState(payload))
      .on("broadcast", { event: EVENT_GESTURE }, ({ payload }) => this.onGesture(payload))
      .on("broadcast", { event: EVENT_MODERATION }, ({ payload }) => void this.onModeration(payload))
      .on("broadcast", { event: EVENT_ROSE }, ({ payload }) => this.onRose(payload))
      .on("broadcast", { event: EVENT_WISH }, () => this.scheduleWishReload())
      .on("presence", { event: "sync" }, () => this.syncPresence())
      .on("presence", { event: "leave" }, ({ key }) => {
        if (key && key !== uid) {
          this.remotes.delete(key);
          this.syncPresence();
        }
      });

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      channel.subscribe((status, err) => {
        if (channel !== this.channel) return; // 이미 교체된 채널
        if (status === "SUBSCRIBED") {
          this.reconnector?.reset();
          this.emit({ status: "connected", error: null });
          // 새로 들어온 쪽은 Presence 초기 상태로 다른 사람 위치를 받고,
          // 기존 사람들은 내 Presence(위치 포함)와 아래 한 번의 상태 방송으로 나를 알게 됩니다.
          presence.update(this.presenceMeta(), true);
          this.sendState();
          void this.loadWishes();
          void this.loadFlowers();
          if (!settled) {
            settled = true;
            resolve();
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (!this.wantConnected) return;
          const msg = err?.message ?? status;
          this.emit({ status: "reconnecting", error: msg });
          this.metrics.reconnects++;
          if (!settled) {
            settled = true;
            reject(new Error(msg));
          } else {
            this.teardownChannel();
            this.reconnector?.schedule();
          }
        }
      });
    });
  }

  private teardownChannel() {
    this.presence?.dispose();
    this.presence = null;
    if (this.channel && this.sb) {
      const ch = this.channel;
      this.channel = null;
      void this.sb.removeChannel(ch);
    }
  }

  async disconnect(): Promise<void> {
    this.wantConnected = false;
    this.generation++; // 진행 중인 연결 시도 무효화
    if (typeof window !== "undefined") window.removeEventListener("offline", this.onOffline);
    this.reconnector?.dispose();
    this.reconnector = null;
    if (this.janitor) clearInterval(this.janitor);
    this.janitor = null;
    // 방 자리를 바로 비워 다른 사람이 들어올 수 있게 함 (실패해도 1분 30초 뒤 자동으로 빠짐)
    if (this.sb && this.env?.privateChannels && this.snapshot.uid) void this.sb.rpc("leave_room").then(undefined, () => {});
    if (this.channel) {
      try {
        await this.channel.untrack();
      } catch {
        /* 이미 끊김 */
      }
    }
    this.teardownChannel();
    this.remotes.clear();
    this.roses.clear();
    this.emit({ status: this.sb ? "idle" : "disabled", count: 1, others: [] });
  }

  // ---------- 보내기 ----------
  private presenceMeta(): PresenceMeta {
    const s = this.local;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    return {
      n: this.nickname,
      a: s?.pose === "sit" ? 1 : 0,
      c: s?.pose === "sit" ? s.seatId : null,
      j: this.joinedAt,
      p: s ? [r2(s.x), r2(s.z), r2(s.yaw)] : undefined,
    };
  }

  /** 매 프레임 호출. 실제 전송 여부는 여기서 판단합니다 */
  updateLocal(state: PlayerState, now = Date.now()): void {
    this.local = state;
    if (!this.channel || this.snapshot.status !== "connected") return;
    const last = this.lastSent;
    const poseChanged = !last || last.pose !== state.pose || last.seatId !== state.seatId;
    if (poseChanged) {
      this.presence?.update(this.presenceMeta());
      this.sendState();
      return;
    }
    // 걷기 ↔ 달리기 전환은 바로 알려서 다른 사람 화면의 애니메이션도 곧바로 바뀌게 함
    if (state.moving && last.moving && state.running !== last.running && now - this.lastSentAt >= 150) {
      this.sendState();
      return;
    }
    const interval = 1000 / this.metrics.sendHz;
    const moved = Math.hypot(state.x - last.x, state.z - last.z) > 0.02 || Math.abs(state.yaw - last.yaw) > 0.05;
    if (state.moving && moved && now - this.lastSentAt >= interval) {
      this.sendState();
    } else if (!state.moving && (last.moving || moved) && now - this.lastSentAt >= interval) {
      this.sendState(); // 멈춘 순간의 최종 위치
      this.presence?.update(this.presenceMeta()); // 나중에 들어올 사람을 위한 위치 (최소 2초 간격)
    } else if (now - this.lastSentAt >= IDLE_RESEND_MS) {
      this.sendState(); // 드문 재전송: 유실 복구
    }
  }

  private sendState() {
    const ch = this.channel;
    const uid = this.snapshot.uid;
    if (!ch || !uid || !this.local || this.snapshot.status !== "connected") return;
    const payload = encodeState(uid, ++this.seq, this.local);
    this.lastSent = { ...this.local };
    this.lastSentAt = Date.now();
    void ch.send({ type: "broadcast", event: EVENT_STATE, payload });
    this.countSent(JSON.stringify(payload).length);
  }

  private countSent(bytes: number) {
    this.metrics.sentTotal++;
    this.metrics.sentBytes += bytes;
    this.rateWindow.sent++;
  }

  // ---------- 받기 ----------
  private onState(raw: unknown) {
    const now = Date.now();
    this.metrics.recvTotal++;
    this.rateWindow.recv++;
    try {
      this.metrics.recvBytes += JSON.stringify(raw).length;
    } catch {
      /* ignore */
    }
    const msg = validateState(raw, now);
    if (!msg || msg.u === this.snapshot.uid || this.banned.has(msg.u)) {
      this.metrics.droppedInvalid++;
      return;
    }
    let r = this.remotes.get(msg.u);
    if (!r) {
      // Presence에 없는 id가 보낸 메시지는 무시 (아직 sync 전이면 다음 메시지에서 처리)
      const member = this.presence?.members().get(msg.u);
      if (!member) {
        this.metrics.droppedInvalid++;
        return;
      }
      r = this.createRemote(msg.u, member.meta.n);
    }
    if (msg.s <= r.lastSeq) {
      this.metrics.droppedStale++;
      return;
    }
    r.lastSeq = msg.s;
    r.lastHeard = now;
    const poseChanged = r.pose !== poseOf(msg);
    r.pose = poseOf(msg);
    r.seatId = msg.c;
    r.moving = msg.m === 1;
    r.anim = animOf(msg);
    r.buffer.push({ time: now, x: msg.p[0], y: msg.p[1], z: msg.p[2], yaw: msg.r });

    this.latencySamples.push(now - msg.t);
    if (this.latencySamples.length > 50) this.latencySamples.shift();
    if (poseChanged) this.publishPlayers();
  }

  private createRemote(uid: string, nick: string): RemotePlayer {
    const r: RemotePlayer = {
      uid,
      nick,
      tag: idTag(uid),
      buffer: new SnapshotBuffer(),
      lastSeq: -1,
      lastHeard: Date.now(),
      pose: "stand",
      seatId: null,
      moving: false,
      anim: "idle",
      present: true,
      bow: { at: 0 },
      cross: { at: 0 },
      holdingRose: false,
      heldFlower: 0,
      lastRoseAt: 0,
    };
    this.remotes.set(uid, r);
    return r;
  }

  private syncPresence() {
    if (!this.presence) return;
    const members = this.presence.members();
    const me = this.snapshot.uid;
    for (const [uid, m] of members) {
      if (uid === me || this.banned.has(uid)) continue;
      let r = this.remotes.get(uid);
      if (!r) r = this.createRemote(uid, m.meta.n);
      r.nick = m.meta.n;
      r.present = true;
      // 위치 메시지를 아직 못 받았다면 Presence에 있는 마지막 위치(또는 좌석)로 표시
      if (r.buffer.size === 0) {
        const seat = m.meta.a === 1 && m.meta.c ? SEAT_BY_ID.get(m.meta.c) : undefined;
        if (seat) {
          r.pose = "sit";
          r.seatId = seat.id;
          r.buffer.push({ time: Date.now(), x: seat.x, y: 0, z: seat.z, yaw: seat.yaw });
        } else if (m.meta.p) {
          const [x, z, yaw] = m.meta.p;
          r.buffer.push({ time: Date.now(), x, y: floorHeight(z), z, yaw });
        }
      }
    }
    for (const [uid, r] of this.remotes) if (!members.has(uid)) r.present = false;
    this.publishPlayers();
  }

  private publishPlayers() {
    const others = [...this.remotes.values()]
      .filter((r) => r.present)
      .map((r) => ({ uid: r.uid, nick: r.nick, tag: r.tag, pose: r.pose }));
    this.emit({ others, count: others.length + 1 });
    this.metrics.sendHz = sendRateHz(others.length + 1, this.env?.messageBudget);
  }

  /** 1초마다: 끊긴 아바타 제거, 초당 메시지 수 계산 */
  private cleanup() {
    const now = Date.now();
    if (this.snapshot.status === "connected" && now - this.lastWishLoad >= WISH_REFRESH_MS) void this.loadWishes();
    if (this.snapshot.status === "connected" && now - this.lastFlowerLoad >= WISH_REFRESH_MS) void this.loadFlowers();
    if (this.sb && this.env?.privateChannels && this.snapshot.status === "connected" && now - this.lastHeartbeat >= HEARTBEAT_MS) {
      this.lastHeartbeat = now;
      void this.sb.rpc("touch_session").then(undefined, () => {});
    }
    let changed = false;
    for (const [uid, r] of this.remotes) {
      if (!r.present && now - r.lastHeard > STALE_REMOVE_MS) {
        this.remotes.delete(uid);
        changed = true;
      }
    }
    if (changed) this.publishPlayers();
    const dt = (now - (this.rateWindow.at || now - 1000)) / 1000 || 1;
    this.metrics.sentPerSec = this.rateWindow.sent / dt;
    this.metrics.recvPerSec = this.rateWindow.recv / dt;
    this.rateWindow = { sent: 0, recv: 0, at: now };
    if (this.latencySamples.length) {
      const sorted = [...this.latencySamples].sort((a, b) => a - b);
      this.metrics.latencyMs = sorted[Math.floor(sorted.length / 2)];
    }
  }

  /** 렌더링 시 사용할 보간 지연 */
  get interpolationDelay(): number {
    return interpolationDelayMs(this.metrics.sendHz);
  }

  /** 절 같은 짧은 동작을 같은 방 사람들에게 알림 */
  sendGesture(g: Gesture): void {
    const ch = this.channel;
    const uid = this.snapshot.uid;
    if (!ch || !uid || this.snapshot.status !== "connected") return;
    const payload: GestureMessage = { v: PROTOCOL_VERSION, u: uid, t: Date.now(), g };
    void ch.send({ type: "broadcast", event: EVENT_GESTURE, payload });
    this.countSent(JSON.stringify(payload).length);
  }

  private onGesture(raw: unknown) {
    const now = Date.now();
    this.metrics.recvTotal++;
    this.rateWindow.recv++;
    const msg = validateGesture(raw, now);
    const r = msg ? this.remotes.get(msg.u) : undefined;
    if (!msg || !r || !r.present) {
      this.metrics.droppedInvalid++;
      return;
    }
    const g = msg.g === "cross" ? r.cross : r.bow;
    if (now - g.at < GESTURE_MIN_MS) return;
    g.at = now;
  }

  // ---------- 꽃 ----------

  /** 꽃을 받음/바침/뿌림/치움을 같은 방 사람들에게 바로 알림 (저장은 placeFlower/sweepFlowers) */
  sendRose(k: RoseMessage["k"], seed: number, at?: { x: number; z: number }, flower?: number): void {
    const ch = this.channel;
    const uid = this.snapshot.uid;
    if (!ch || !uid || this.snapshot.status !== "connected") return;
    const payload: RoseMessage = { v: PROTOCOL_VERSION, u: uid, t: Date.now(), k, s: seed };
    if ((k === "floor" || k === "floorRose" || k === "sweep") && at) payload.p = [Math.round(at.x * 100) / 100, Math.round(at.z * 100) / 100];
    if (flower !== undefined && isFlower(flower)) payload.f = flower;
    void ch.send({ type: "broadcast", event: EVENT_ROSE, payload });
    this.countSent(JSON.stringify(payload).length);
  }

  private onRose(raw: unknown) {
    const now = Date.now();
    this.metrics.recvTotal++;
    this.rateWindow.recv++;
    const msg = validateRose(raw, now);
    const r = msg ? this.remotes.get(msg.u) : undefined;
    if (!msg || !r || !r.present) {
      this.metrics.droppedInvalid++;
      return;
    }
    if (msg.k === "pick") {
      r.holdingRose = true;
      r.heldFlower = isFlower(msg.f) ? msg.f : 0;
      return;
    }
    if (msg.k === "sweep") {
      // 치우기는 누구나, 다만 너무 잦지 않게
      if (now - r.lastRoseAt < ROSE_MIN_INTERVAL_MS || !msg.p) return;
      r.lastRoseAt = now;
      this.roses.sweep(msg.p[0], msg.p[1]);
      this.scheduleFlowerReload();
      return;
    }
    // 바치기·뿌리기는 꽃을 들고 있었고 너무 잦지 않을 때만 (도배 방지)
    if (!r.holdingRose || now - r.lastRoseAt < ROSE_MIN_INTERVAL_MS) return;
    r.lastRoseAt = now;
    r.holdingRose = false;
    const flower = isFlower(msg.f) ? msg.f : r.heldFlower;
    if ((msg.k === "floor" || msg.k === "floorRose") && msg.p)
      this.roses.add(msg.k, msg.s, { x: msg.p[0], y: floorHeight(msg.p[1]), z: msg.p[1] }, flower, "remote");
    else if (msg.k === "mary" || msg.k === "jesus") this.roses.add(msg.k as RoseTarget, msg.s, undefined, flower, "remote");
    // 보낸 사람이 저장할 시간을 두고 서버 목록을 다시 읽음 (저장된 자리·시각으로 맞춰짐)
    this.scheduleFlowerReload();
  }

  /** 서버에서 12시간 안의 꽃을 읽어 옴 (모든 방이 같은 꽃을 봄). 서버에 표가 없으면 아무것도 하지 않음 */
  async loadFlowers(): Promise<void> {
    if (!this.sb || !this.env?.privateChannels) return;
    const requestedAt = Date.now();
    this.lastFlowerLoad = requestedAt;
    let data: unknown;
    try {
      const res = await this.sb
        .from("flower_offerings")
        .select("id, target, flower, seed, x, z, created_at")
        .order("created_at", { ascending: false })
        .limit(400);
      if (res.error) return;
      data = res.data;
    } catch {
      return;
    }
    if (!Array.isArray(data)) return;
    const rows: FlowerRecord[] = [];
    for (const row of data as Record<string, unknown>[]) {
      const createdAt = Date.parse(String(row.created_at));
      const target = row.target;
      if (typeof row.id !== "number" || !Number.isFinite(createdAt) || typeof row.seed !== "number") continue;
      if (target !== "mary" && target !== "jesus" && target !== "floor" && target !== "floorRose") continue;
      const rec: FlowerRecord = { id: row.id, target, flower: isFlower(row.flower) ? row.flower : 0, seed: row.seed, createdAt };
      if (target === "floor" || target === "floorRose") {
        if (typeof row.x !== "number" || typeof row.z !== "number") continue;
        rec.x = row.x;
        rec.z = row.z;
        rec.y = floorHeight(row.z);
      }
      rows.push(rec);
    }
    this.roses.replaceFromServer(rows, requestedAt);
  }

  private scheduleFlowerReload() {
    if (this.flowerReload) return;
    this.flowerReload = setTimeout(() => {
      this.flowerReload = null;
      void this.loadFlowers();
    }, 1800);
  }

  /** 내가 놓은 꽃을 서버에 저장 (12시간). 실패하면 이 기기 화면에만 남음 */
  async placeFlower(rec: FlowerRecord): Promise<void> {
    if (!this.sb || !this.env?.privateChannels || this.snapshot.status !== "connected") return;
    try {
      const floor = rec.target === "floor" || rec.target === "floorRose";
      const { data, error } = await this.sb.rpc("place_flower", {
        p_target: rec.target,
        p_flower: rec.flower,
        p_seed: rec.seed,
        p_x: floor ? rec.x : null,
        p_z: floor ? rec.z : null,
      });
      if (!error && typeof data === "number") this.roses.confirm(rec.id, data);
    } catch {
      /* 저장 못 해도 화면에는 남음 */
    }
  }

  /** 내 주변 바닥 꽃 치우기를 서버에도 반영 (남이 놓은 꽃도) */
  async sweepFlowers(x: number, z: number): Promise<void> {
    if (!this.sb || !this.env?.privateChannels || this.snapshot.status !== "connected") return;
    try {
      await this.sb.rpc("sweep_flowers", { p_x: x, p_z: z });
    } catch {
      /* 다음 목록 새로고침 때 맞춰짐 */
    }
  }

  // ---------- 소원 초 ----------

  /** 서버에서 12시간 안의 소원 초를 읽어 옴 (모든 방이 같은 초 제단을 공유) */
  async loadWishes(): Promise<void> {
    if (!this.sb || !this.env?.privateChannels) return;
    this.lastWishLoad = Date.now();
    let data: unknown;
    try {
      const res = await this.sb
        .from("wish_candles")
        .select("id, user_id, nickname, wish, color, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (res.error) return; // 아직 SQL 을 실행하지 않았거나 네트워크 문제 → 다음 주기에 다시
      data = res.data;
    } catch {
      return;
    }
    if (!Array.isArray(data)) return;
    const list: WishCandle[] = [];
    for (const row of data as Record<string, unknown>[]) {
      const createdAt = Date.parse(String(row.created_at));
      if (typeof row.id !== "number" || typeof row.wish !== "string" || typeof row.nickname !== "string" || !Number.isFinite(createdAt)) continue;
      const color = typeof row.color === "number" && row.color >= 0 && row.color < 12 ? row.color : 0;
      list.push({ id: row.id, userId: String(row.user_id ?? ""), nickname: row.nickname, wish: row.wish, color, createdAt });
    }
    this.wishes.set(list);
  }

  private scheduleWishReload() {
    if (this.wishReload) return;
    this.wishReload = setTimeout(() => {
      this.wishReload = null;
      void this.loadWishes();
    }, 400);
  }

  private announceWishChange() {
    const ch = this.channel;
    const uid = this.snapshot.uid;
    if (!ch || !uid || this.snapshot.status !== "connected") return;
    void ch.send({ type: "broadcast", event: EVENT_WISH, payload: { v: PROTOCOL_VERSION, u: uid, t: Date.now() } });
  }

  /**
   * 소원 초 켜기. 온라인이면 서버에 저장(12시간 동안 모두에게 보임),
   * 혼자 머무는 모드(Supabase 없음)면 이 기기 화면에만 잠시 보임.
   */
  async lightWish(wish: string, color: number, nickname: string): Promise<LightResult> {
    if (!isValidWish(wish)) return { ok: false, reason: "invalid" };
    if (!this.sb || !this.env?.privateChannels) {
      this.wishes.add({ id: -Date.now(), userId: "local", nickname, wish, color, createdAt: Date.now() });
      return { ok: true };
    }
    if (this.snapshot.status !== "connected") return { ok: false, reason: "notInRoom" };
    const { data, error } = await this.sb.rpc("light_candle", { p_wish: wish, p_color: color });
    if (error) return { ok: false, reason: lightErrorReason(error) };
    if (typeof data === "number") {
      this.wishes.add({ id: data, userId: this.snapshot.uid ?? "", nickname, wish, color, createdAt: Date.now() });
    }
    this.announceWishChange();
    return { ok: true };
  }

  /** 소원 초 끄기 (자기 초 또는 관리자) */
  async removeWish(id: number): Promise<boolean> {
    if (id < 0 || !this.sb) {
      this.wishes.remove(id);
      return true;
    }
    const { error } = await this.sb.rpc("remove_candle", { p_id: id });
    if (error) return false;
    this.wishes.remove(id);
    this.announceWishChange();
    return true;
  }

  // ---------- 관리자 내보내기 ----------

  private async refreshAdmin() {
    if (!this.sb) return;
    const { data, error } = await this.sb.rpc("is_admin");
    this.emit({ isAdmin: !error && data === true });
  }

  /** 설정의 관리자 비밀번호. 맞으면 이 기기가 관리자가 됨 */
  async claimAdmin(code: string): Promise<boolean> {
    if (!this.sb || !this.env?.privateChannels) return false;
    const { data, error } = await this.sb.rpc("claim_admin", { p_code: code });
    const ok = !error && data === true;
    if (ok) this.emit({ isAdmin: true });
    return ok;
  }

  /** 관리자: 서버에 차단을 기록하고, 같은 방 사람들에게 알림 */
  async banUser(target: string): Promise<boolean> {
    const uid = this.snapshot.uid;
    if (!this.sb || !uid || !this.snapshot.isAdmin || target === uid) return false;
    const { error } = await this.sb.rpc("ban_user", { p_target: target });
    if (error) return false;
    this.hideBanned(target);
    const ch = this.channel;
    if (ch) {
      const payload: ModerationMessage = { v: PROTOCOL_VERSION, u: uid, t: Date.now(), k: "ban", x: target };
      void ch.send({ type: "broadcast", event: EVENT_MODERATION, payload });
      this.countSent(JSON.stringify(payload).length);
    }
    return true;
  }

  /** 알림은 누구나 흉내 낼 수 있으므로 서버에 확인한 뒤에만 따름 */
  private async onModeration(raw: unknown) {
    const msg = validateModeration(raw);
    if (!msg || !this.sb) {
      this.metrics.droppedInvalid++;
      return;
    }
    if (msg.x === this.snapshot.uid) {
      const { data, error } = await this.sb.rpc("am_i_banned");
      if (!error && data === true) this.onBannedSelf();
      return;
    }
    if (this.banned.has(msg.x)) return;
    const { data, error } = await this.sb.rpc("is_banned", { p_target: msg.x });
    if (!error && data === true) this.hideBanned(msg.x);
  }

  private hideBanned(uid: string) {
    this.banned.add(uid);
    this.remotes.delete(uid);
    this.publishPlayers();
  }

  /** 내가 차단됨: 연결을 끊고 다시 시도하지 않음 (혼자 머무는 상태로) */
  private onBannedSelf() {
    this.wantConnected = false;
    this.generation++;
    this.reconnector?.dispose();
    this.reconnector = null;
    this.teardownChannel();
    this.remotes.clear();
    this.emit({ status: "banned", error: "banned", count: 1, others: [] });
  }

  occupiedSeats(): Set<string> {
    const s = new Set<string>();
    for (const r of this.remotes.values()) if (r.present && r.pose === "sit" && r.seatId) s.add(r.seatId);
    return s;
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

let singleton: NetworkManager | null = null;
export function getNetworkManager(): NetworkManager {
  if (!singleton) singleton = new NetworkManager();
  return singleton;
}
