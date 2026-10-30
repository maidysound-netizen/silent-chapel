// ⚠ 시뮬레이션 테스트: 실제 Supabase에 연결하지 않습니다.
// 메모리 안의 '가짜 Realtime 서버'로 NetworkManager의 로직(Presence 처리, 위치 수신, 오래된 메시지 무시,
// 퇴장 처리, 재연결, 전송 주기 조절)을 검증합니다. 실제 네트워크 동작은 docs/TEST_RESULTS.md의
// 수동 테스트 절차로 별도 확인해야 합니다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NetworkManager } from "../src/lib/net/NetworkManager.ts";
import { createPlayerState, type PlayerState } from "../src/lib/game/PlayerState.ts";
import { SEATS } from "../src/lib/game/chapelLayout.ts";
import { encodeState } from "../src/lib/net/protocol.ts";

type Handler = { type: string; event: string; cb: (p: any) => void };

class FakeServer {
  channels = new Set<FakeChannel>();
  presence = new Map<FakeChannel, { key: string; meta: Record<string, unknown> }>();
  delivered = 0;
  /** 가짜 DB 방 정원 (설정하지 않으면 join_room 은 항상 성공) */
  rooms: Map<string, { max: number; members: Set<string> }> | null = null;

  /** 가짜 DB 관리자·차단 목록 */
  admins = new Set<string>();
  bannedUsers = new Set<string>();
  adminCode = "correct-horse";

  rpc(uid: string, name: string, args: any): { data?: unknown; error: { code: string; message: string } | null } {
    switch (name) {
      case "claim_admin":
        if (args.p_code !== this.adminCode) return { data: false, error: null };
        this.admins.add(uid);
        return { data: true, error: null };
      case "is_admin":
        return { data: this.admins.has(uid), error: null };
      case "ban_user":
        if (!this.admins.has(uid)) return { error: { code: "42501", message: "not admin" } };
        this.bannedUsers.add(args.p_target);
        return { error: null };
      case "is_banned":
        return { data: this.bannedUsers.has(args.p_target), error: null };
      case "am_i_banned":
        return { data: this.bannedUsers.has(uid), error: null };
    }
    if (name === "join_room" && this.bannedUsers.has(uid)) return { error: { code: "P0003", message: "banned" } };
    if (!this.rooms) return { error: null };
    if (name === "leave_room") {
      for (const r of this.rooms.values()) r.members.delete(uid);
      return { error: null };
    }
    if (name !== "join_room") return { error: null };
    const room = this.rooms.get(args.p_room_id);
    if (!room) return { error: { code: "P0002", message: "room not found" } };
    const others = [...room.members].filter((m) => m !== uid).length;
    if (others >= room.max) return { error: { code: "P0001", message: "room is full" } };
    for (const r of this.rooms.values()) r.members.delete(uid);
    room.members.add(uid);
    return { error: null };
  }

  state(topic: string) {
    const out: Record<string, unknown[]> = {};
    for (const [ch, p] of this.presence) if (ch.topic === topic) (out[p.key] ??= []).push({ ...p.meta, presence_ref: "x" });
    return out;
  }
  emitPresence(topic: string, event: "join" | "leave", key: string) {
    for (const ch of this.channels) if (ch.topic === topic && ch.joined) {
      ch.fire("presence", event, { key });
      ch.fire("presence", "sync", {});
    }
  }
  /** 서버 쪽에서 연결이 끊긴 상황 (예: 네트워크 단절 후 하트비트 실패) */
  drop(ch: FakeChannel) {
    this.leave(ch);
    ch.statusCb?.("CHANNEL_ERROR", new Error("simulated drop"));
  }
  leave(ch: FakeChannel) {
    const p = this.presence.get(ch);
    this.presence.delete(ch);
    this.channels.delete(ch);
    ch.joined = false;
    if (p) this.emitPresence(ch.topic, "leave", p.key);
  }
}

class FakeChannel {
  handlers: Handler[] = [];
  joined = false;
  statusCb: ((s: string, e?: Error) => void) | null = null;
  server: FakeServer;
  topic: string;
  opts: any;
  constructor(server: FakeServer, topic: string, opts: any) {
    this.server = server;
    this.topic = topic;
    this.opts = opts;
  }
  on(type: string, filter: { event: string }, cb: (p: any) => void) {
    this.handlers.push({ type, event: filter.event, cb });
    return this;
  }
  fire(type: string, event: string, payload: any) {
    for (const h of this.handlers) if (h.type === type && h.event === event) h.cb(payload);
  }
  subscribe(cb: (s: string, e?: Error) => void) {
    this.statusCb = cb;
    queueMicrotask(() => {
      this.joined = true;
      this.server.channels.add(this);
      cb("SUBSCRIBED");
    });
    return this;
  }
  async track(meta: Record<string, unknown>) {
    const key = this.opts.config.presence.key;
    const isNew = !this.server.presence.has(this);
    this.server.presence.set(this, { key, meta });
    this.server.emitPresence(this.topic, "join", key);
    return isNew ? "ok" : "ok";
  }
  async untrack() {
    const p = this.server.presence.get(this);
    this.server.presence.delete(this);
    if (p) this.server.emitPresence(this.topic, "leave", p.key);
    return "ok";
  }
  presenceState() {
    return this.server.state(this.topic);
  }
  async send(msg: { type: string; event: string; payload: unknown }) {
    for (const ch of this.server.channels) {
      if (ch !== this && ch.topic === this.topic && ch.joined) {
        this.server.delivered++;
        // 실제 네트워크처럼 JSON 직렬화를 거쳐 전달
        ch.fire("broadcast", msg.event, { payload: JSON.parse(JSON.stringify(msg.payload)) });
      }
    }
    return "ok";
  }
}

function fakeClient(server: FakeServer) {
  const uid = randomUUID();
  const channels: FakeChannel[] = [];
  return {
    uid,
    channels,
    client: {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: uid } } } }),
        signInAnonymously: async () => ({ data: { user: { id: uid } }, error: null }),
      },
      rpc: async (name: string, args?: any) => server.rpc(uid, name, args),
      realtime: { setAuth: async () => {} },
      channel: (topic: string, opts: any) => {
        const ch = new FakeChannel(server, topic, opts);
        channels.push(ch);
        return ch;
      },
      removeChannel: async (ch: FakeChannel) => {
        server.leave(ch);
        ch.statusCb?.("CLOSED");
        return "ok";
      },
    } as any,
  };
}

const ENV = { url: "http://fake", key: "fake", privateChannels: true, messageBudget: 80 };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tick = () => sleep(5);

async function makePlayers(n: number, server = new FakeServer()) {
  const players = [];
  for (let i = 0; i < n; i++) {
    const fc = fakeClient(server);
    const net = new NetworkManager(fc.client, ENV);
    await net.connect("main-chapel", `Visitor${i + 1}`);
    players.push({ ...fc, net });
  }
  await tick();
  return { server, players };
}

test("[시뮬레이션] 두 명 입장: 서로를 Presence로 인식", async () => {
  const { players } = await makePlayers(2);
  const [a, b] = players;
  assert.equal(a.net.getSnapshot().status, "connected");
  assert.equal(a.net.getSnapshot().count, 2);
  assert.equal(b.net.getSnapshot().count, 2);
  assert.equal(a.net.getSnapshot().others[0].nick, "Visitor2");
  assert.equal(b.net.getSnapshot().others[0].uid, a.uid);
  await a.net.disconnect();
  await b.net.disconnect();
});

test("[시뮬레이션] 위치·앉기 동기화와 보간", async () => {
  const { players } = await makePlayers(2);
  const [a, b] = players;
  let s: PlayerState = { ...createPlayerState(0, 10, 0), moving: true };
  a.net.updateLocal(s); // 첫 전송 (poseChanged)
  for (let i = 1; i <= 5; i++) {
    await sleep(110);
    s = { ...s, z: 10 - i * 0.25 };
    a.net.updateLocal(s);
  }
  await tick();
  const remote = b.net.remotes.get(a.uid)!;
  assert.ok(remote.buffer.size >= 3, `받은 스냅샷 ${remote.buffer.size}`);
  const latest = remote.buffer.latest()!;
  assert.ok(Math.abs(latest.z - 8.75) < 0.01, `z=${latest.z}`);
  const mid = remote.buffer.sample(Date.now() - 160)!;
  assert.ok(mid.z < 10 && mid.z > 8.7, `보간 z=${mid.z}`);

  // 앉기
  const seat = SEATS[0];
  a.net.updateLocal({ ...s, x: seat.x, z: seat.z, moving: false, pose: "sit", seatId: seat.id });
  await tick();
  assert.equal(b.net.remotes.get(a.uid)!.pose, "sit");
  assert.ok(b.net.occupiedSeats().has(seat.id));
  assert.equal(b.net.getSnapshot().others[0].pose, "sit");
  await a.net.disconnect();
  await b.net.disconnect();
});

test("[시뮬레이션] 오래된(순번이 낮은) 메시지와 위조 형식 메시지는 무시", async () => {
  const { players } = await makePlayers(2);
  const [a, b] = players;
  a.net.updateLocal(createPlayerState(1, 1, 0));
  await tick();
  const r = b.net.remotes.get(a.uid)!;
  const seqBefore = r.lastSeq;
  const ch = a.channels[a.channels.length - 1];
  await ch.send({ type: "broadcast", event: "st", payload: encodeState(a.uid, 0, createPlayerState(5, 5, 0)) });
  await ch.send({ type: "broadcast", event: "st", payload: { v: 1, u: a.uid, s: 999, p: "bad" } });
  // Presence에 없는 id로 보낸 메시지
  await ch.send({ type: "broadcast", event: "st", payload: encodeState(randomUUID(), 1, createPlayerState(0, 0, 0)) });
  await tick();
  assert.equal(r.lastSeq, seqBefore);
  assert.equal(b.net.metrics.droppedStale, 1);
  assert.equal(b.net.metrics.droppedInvalid, 2);
  assert.equal(b.net.remotes.size, 1);
  await a.net.disconnect();
  await b.net.disconnect();
});

test("[시뮬레이션] 퇴장하면 상대 화면에서 아바타 제거", async () => {
  const { players } = await makePlayers(2);
  const [a, b] = players;
  await a.net.disconnect();
  await tick();
  assert.equal(b.net.getSnapshot().count, 1);
  assert.equal(b.net.remotes.has(a.uid), false);
  await b.net.disconnect();
});

test("[시뮬레이션] 연결이 끊기면 자동 재연결 후 다시 동기화", async () => {
  const { server, players } = await makePlayers(2);
  const [a, b] = players;
  server.drop(a.channels[a.channels.length - 1]);
  await tick();
  assert.equal(a.net.getSnapshot().status, "reconnecting");
  assert.equal(b.net.getSnapshot().count, 1, "끊긴 사람은 상대에게서 사라짐");
  await sleep(1200); // 첫 재시도 백오프(0.7~1초)
  assert.equal(a.net.getSnapshot().status, "connected");
  assert.equal(a.net.metrics.reconnects, 1);
  assert.equal(b.net.getSnapshot().count, 2, "재접속 후 다시 보임");
  await a.net.disconnect();
  await b.net.disconnect();
});

test("[시뮬레이션] 5명·10명: 접속자 수에 맞춰 전송 주기 감소", async () => {
  const five = await makePlayers(5);
  for (const p of five.players) assert.equal(p.net.getSnapshot().count, 5);
  assert.ok(Math.abs(five.players[0].net.metrics.sendHz - 3.2) < 1e-9);
  for (const p of five.players) await p.net.disconnect();

  const ten = await makePlayers(10);
  for (const p of ten.players) assert.equal(p.net.getSnapshot().count, 10);
  assert.equal(ten.players[0].net.metrics.sendHz, 1);
  // 10명이 2초 동안 계속 움직일 때 서버가 전달한 메시지 수 추정 (입장 직후 포함)
  const start = ten.server.delivered;
  const t0 = Date.now();
  while (Date.now() - t0 < 2000) {
    for (const [i, p] of ten.players.entries()) {
      p.net.updateLocal({ ...createPlayerState(i - 5, (Date.now() - t0) / 400, 0), moving: true });
    }
    await sleep(50);
  }
  const perSec = (ten.server.delivered - start) / 2;
  // 각자 1Hz × 9명 수신 = 약 90건/초 (+ 보낸 10건). 무료 플랜 100건/초를 넘지 않는 수준
  console.log(`  10명 이동 중 전달된 broadcast: ${perSec}/s`);
  assert.ok(perSec <= 100, `받은 메시지 ${perSec}/s`);
  for (const p of ten.players) await p.net.disconnect();
});

test("[시뮬레이션] 늦게 들어온 사람은 Presence만으로 기존 방문자 위치를 앎 (재방송 없음)", async () => {
  const server = new FakeServer();
  const { players } = await makePlayers(1, server);
  const [a] = players;
  a.net.updateLocal({ ...createPlayerState(2, 3, 0), moving: true });
  await sleep(120);
  a.net.updateLocal({ ...createPlayerState(2.5, 3, 0), moving: false }); // 멈춤 → Presence에 위치 기록
  await sleep(2100); // Presence 갱신 최소 간격
  const before = server.delivered;
  const { players: late } = await makePlayers(1, server);
  const b = late[0];
  const r = b.net.remotes.get(a.uid)!;
  assert.ok(r, "기존 방문자를 인식");
  const pos = r.buffer.latest()!;
  assert.equal(pos.x, 2.5);
  assert.equal(pos.z, 3);
  // 새 입장자가 보낸 1건 외에 기존 방문자의 재방송은 없음
  assert.ok(server.delivered - before <= 1, `입장 시 broadcast ${server.delivered - before}건`);
  await a.net.disconnect();
  await b.net.disconnect();
});

test("[시뮬레이션] 절하기: 상대에게 전달되고, 짧은 시간 안의 반복은 무시", async () => {
  const { players } = await makePlayers(2);
  const [a, b] = players;
  a.net.sendGesture("bow");
  await tick();
  const first = b.net.remotes.get(a.uid)!.bow.at;
  assert.ok(first > 0, "B가 A의 절을 받음");
  a.net.sendGesture("bow"); // 2초 안의 반복
  await tick();
  assert.equal(b.net.remotes.get(a.uid)!.bow.at, first);
  await a.net.disconnect();
  await b.net.disconnect();
});

test("[시뮬레이션] 방이 가득 차면 다음 방으로 자동 입장, 모두 차면 full", async () => {
  const server = new FakeServer();
  // 정원 2명짜리 방 두 개만 있는 상황 (chapel-3 부터는 아직 DB에 없음)
  server.rooms = new Map([
    ["main-chapel", { max: 2, members: new Set() }],
    ["chapel-2", { max: 2, members: new Set() }],
  ]);
  const players: (ReturnType<typeof fakeClient> & { net: NetworkManager })[] = [];
  for (let i = 0; i < 5; i++) {
    const fc = fakeClient(server);
    const net = new NetworkManager(fc.client, ENV);
    void net.connect("main-chapel", `Visitor${i + 1}`);
    await tick();
    players.push({ ...fc, net });
  }
  await tick();
  const rooms = players.map((p) => p.net.getSnapshot().roomId);
  assert.deepEqual(rooms.slice(0, 4), ["main-chapel", "main-chapel", "chapel-2", "chapel-2"]);
  // 방마다 따로: 각 방에서 2명씩 보임
  assert.equal(players[0].net.getSnapshot().count, 2);
  assert.equal(players[2].net.getSnapshot().count, 2);
  assert.ok(!players[2].net.getSnapshot().others.some((o) => o.uid === players[0].uid), "다른 방 사람은 안 보임");
  // 5번째: 모든 방이 가득
  assert.equal(players[4].net.getSnapshot().status, "full");
  // 한 명이 나가면 자리가 비어 다음 사람이 들어올 수 있음
  await players[0].net.disconnect();
  assert.equal(server.rooms.get("main-chapel")!.members.size, 1);
  for (const p of players) await p.net.disconnect();
});

test("[시뮬레이션] 관리자 내보내기: 비밀번호 확인 → 차단 → 상대는 연결 끊김, 다른 사람 화면에서도 사라짐, 재입장 거절", async () => {
  const { server, players } = await makePlayers(3);
  const [admin, troll, other] = players;
  assert.equal(await admin.net.claimAdmin("wrong-password"), false);
  assert.equal(admin.net.getSnapshot().isAdmin, false);
  // 관리자가 아니면 내보낼 수 없음
  assert.equal(await other.net.banUser(troll.uid), false);
  assert.equal(await admin.net.claimAdmin("correct-horse"), true);
  assert.equal(admin.net.getSnapshot().isAdmin, true);

  assert.equal(await admin.net.banUser(troll.uid), true);
  await tick();
  await tick();
  assert.equal(troll.net.getSnapshot().status, "banned", "내보내진 사람은 연결이 끊김");
  assert.ok(!admin.net.getSnapshot().others.some((o) => o.uid === troll.uid), "관리자 화면에서 사라짐");
  assert.ok(!other.net.getSnapshot().others.some((o) => o.uid === troll.uid), "다른 사람 화면에서도 사라짐");
  assert.ok(other.net.getSnapshot().others.some((o) => o.uid === admin.uid), "관리자는 그대로 보임");

  // 다시 들어오려 하면 거절
  await troll.net.connect("main-chapel", "Visitor2");
  await tick();
  assert.equal(troll.net.getSnapshot().status, "banned");
  assert.ok(server.bannedUsers.has(troll.uid));
  for (const p of players) await p.net.disconnect();
});

test("[시뮬레이션] 가짜 내보내기 알림은 서버 확인에서 걸러져 무시됨", async () => {
  const { players } = await makePlayers(3);
  const [faker, victim, other] = players;
  // 관리자가 아닌 사람이 '내보내기' 알림 형식을 흉내 내 직접 보냄
  const ch = faker.channels.at(-1)!;
  for (const target of [victim.uid, other.uid]) {
    ch.send({ type: "broadcast", event: "md", payload: { v: 1, u: faker.uid, t: Date.now(), k: "ban", x: target } });
  }
  await tick();
  await tick();
  assert.equal(victim.net.getSnapshot().status, "connected", "서버가 차단을 확인해 주지 않으면 연결 유지");
  assert.ok(other.net.getSnapshot().others.some((o) => o.uid === victim.uid), "다른 사람 화면에서도 그대로 보임");
  for (const p of players) await p.net.disconnect();
});

test("[시뮬레이션] 성호 긋기: 상대에게 전달되고, 절과 따로 기록됨", async () => {
  const { players } = await makePlayers(2);
  const [a, b] = players;
  a.net.sendGesture("cross");
  await tick();
  const r = b.net.remotes.get(a.uid)!;
  assert.ok(r.cross.at > 0, "B가 A의 성호를 받음");
  assert.equal(r.bow.at, 0, "절은 아님");
  a.net.sendGesture("bow");
  await tick();
  assert.ok(r.bow.at > 0, "성호 직후 절도 따로 받음");
  for (const p of players) await p.net.disconnect();
});

test("[시뮬레이션] 장미: 받은 사람이 바치면 상대 화면에 꽃이 생기고, 받지 않고 보낸 꽃은 무시", async () => {
  const { players } = await makePlayers(2);
  const [a, b] = players;
  // 장미를 받지 않고 바로 바친다는 알림 → 무시
  a.net.sendRose("mary", 1);
  await tick();
  assert.equal(b.net.roses.all().length, 0);
  // 받기 → 들고 있는 모습 → 성모님께 바치기
  a.net.sendRose("pick", 0);
  await tick();
  assert.equal(b.net.remotes.get(a.uid)!.holdingRose, true);
  await sleep(1600); // 도배 방지 간격
  a.net.sendRose("mary", 7);
  await tick();
  assert.equal(b.net.roses.all().length, 1);
  assert.equal(b.net.roses.all()[0].target, "mary");
  assert.equal(b.net.remotes.get(a.uid)!.holdingRose, false, "바친 뒤에는 빈손");
  // 다시 받아 바닥에 뿌리기
  a.net.sendRose("pick", 0);
  await sleep(1600);
  a.net.sendRose("floor", 9, { x: 1, z: 2 });
  await tick();
  const floor = b.net.roses.all().find((r) => r.target === "floor")!;
  assert.ok(floor && Math.abs(floor.x - 1) < 1e-9 && Math.abs(floor.z - 2) < 1e-9);
  for (const p of players) await p.net.disconnect();
});

test("[시뮬레이션] 남이 놓은 바닥 꽃도 치우면 상대 화면에서도 사라짐", async () => {
  const { players } = await makePlayers(2);
  const [a, b] = players;
  a.net.sendRose("pick", 0);
  await tick();
  await sleep(1600);
  a.net.sendRose("floorRose", 5, { x: 1, z: 2 });
  a.net.roses.add("floorRose", 5, { x: 1, y: 0, z: 2 }); // 놓은 사람 화면
  await tick();
  assert.equal(b.net.roses.all().filter((r) => r.target === "floorRose").length, 1, "꽃송이째 놓은 꽃이 보임");
  // B가 치움 → A 화면에서도 사라짐
  assert.equal(b.net.roses.sweep(1.2, 2.1), 1);
  b.net.sendRose("sweep", 0, { x: 1.2, z: 2.1 });
  await tick();
  assert.equal(a.net.roses.all().length, 0);
  for (const p of players) await p.net.disconnect();
});
