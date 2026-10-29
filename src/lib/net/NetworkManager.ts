// 실시간 멀티플레이 총괄.
//   인증(익명) → 방 입장 RPC → Realtime 채널 구독 → Presence(누가 있나) + Broadcast(위치/상태)
//
// 이 성당 MVP는 '클라이언트 권위' 구조입니다. 각 브라우저가 자기 위치를 정해 알리고, 서버는 중계만 합니다.
// 서버가 위치를 검증하지 않으므로 경쟁 게임(FPS)에는 그대로 쓰면 안 됩니다. docs/FPS_MULTIPLAYER_GUIDE.md 참고.

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { PlayerState, Pose } from "../game/PlayerState.ts";
import { SEAT_BY_ID, floorHeight } from "../game/chapelLayout.ts";
import {
  encodeState,
  idTag,
  interpolationDelayMs,
  poseOf,
  sendRateHz,
  validateGesture,
  validateState,
  PROTOCOL_VERSION,
  type Gesture,
  type GestureMessage,
  type PresenceMeta,
} from "./protocol.ts";
import { SnapshotBuffer } from "./PositionInterpolation.ts";
import { PresenceManager } from "./PresenceManager.ts";
import { ReconnectionHandler } from "./ReconnectionHandler.ts";
import { roomTopic } from "./RoomManager.ts";
import { getSupabase, readSupabaseEnv, type SupabaseEnv } from "./supabaseClient.ts";

export type NetStatus = "disabled" | "idle" | "auth" | "connecting" | "connected" | "reconnecting" | "offline" | "error";

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
  /** Presence에 있는지 (없으면 곧 제거) */
  present: boolean;
  /** 절 동작 시작 시각 (아바타가 매 프레임 읽음) */
  bow: { at: number };
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
  others: { uid: string; nick: string; tag: string; pose: Pose }[];
}

const IDLE_RESEND_MS = 20_000;
const STALE_REMOVE_MS = 12_000;
const EVENT_STATE = "st";
const EVENT_GESTURE = "gs";
/** 같은 사람의 제스처는 이 간격보다 자주 받지 않음 (도배 방지) */
const GESTURE_MIN_MS = 2000;

export class NetworkManager {
  private sb: SupabaseClient | null;
  private env: SupabaseEnv | null;
  private channel: RealtimeChannel | null = null;
  private presence: PresenceManager | null = null;
  private reconnector: ReconnectionHandler | null = null;
  private listeners = new Set<() => void>();
  private snapshot: NetSnapshot = { status: "disabled", error: null, uid: null, roomId: null, count: 1, others: [] };
  private nickname = "";
  private seq = 0;
  private lastSentAt = 0;
  private lastSent: PlayerState | null = null;
  private local: PlayerState | null = null;
  private joinedAt = 0;
  private wantConnected = false;
  /** 연결 시도 번호. 더 새로운 시도나 disconnect가 생기면 이전 시도는 중간에 멈춥니다 */
  private generation = 0;
  private janitor: ReturnType<typeof setInterval> | null = null;
  private latencySamples: number[] = [];
  private rateWindow = { sent: 0, recv: 0, at: 0 };

  readonly remotes = new Map<string, RemotePlayer>();
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
      this.emit({ status: "error", error: errorText(e) });
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
    const roomId = this.snapshot.roomId!;
    this.teardownChannel();
    this.emit({ status: this.metrics.reconnects > 0 || this.snapshot.uid ? "reconnecting" : "connecting" });

    const uid = await this.ensureAuth();
    if (stale()) return;
    this.emit({ uid });

    if (this.env.privateChannels) {
      // DB 함수가 방 존재 여부와 닉네임을 검증하고 visitor_sessions 행을 만듭니다.
      // Realtime 권한 정책(RLS)은 이 행이 있는 사용자만 채널에 들어오게 합니다.
      const { error } = await this.sb.rpc("join_room", { p_room_id: roomId, p_nickname: this.nickname });
      if (stale()) return;
      if (error) throw new Error(`방 입장 실패(join_room): ${error.message}`);
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
    if (this.channel) {
      try {
        await this.channel.untrack();
      } catch {
        /* 이미 끊김 */
      }
    }
    this.teardownChannel();
    this.remotes.clear();
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
    if (!msg || msg.u === this.snapshot.uid) {
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
      present: true,
      bow: { at: 0 },
    };
    this.remotes.set(uid, r);
    return r;
  }

  private syncPresence() {
    if (!this.presence) return;
    const members = this.presence.members();
    const me = this.snapshot.uid;
    for (const [uid, m] of members) {
      if (uid === me) continue;
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
    if (now - r.bow.at < GESTURE_MIN_MS) return;
    r.bow.at = now;
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
