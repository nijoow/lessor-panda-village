import test from "node:test";
import assert from "node:assert/strict";
import { loadSource } from "./helpers/load-source.mjs";
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222";
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
function harness(
  session = { user: { id: A }, access_token: "test-only-token" },
) {
  const channels = new Map(),
    timers = new Map(),
    messages = [],
    removed = [];
  let now = 1000,
    timerId = 0;
  const client = {
    auth: { getSession: async () => ({ data: { session }, error: null }) },
    realtime: { setAuth: async () => {} },
    channel(topic) {
      const channel = {
        handlers: [],
        sends: [],
        state: {},
        on(type, filter, handler) {
          this.handlers.push({ type, event: filter.event, handler });
          return this;
        },
        subscribe(handler) {
          this.status = handler;
          return this;
        },
        track: async () => "ok",
        presenceState() {
          return this.state;
        },
        send(message) {
          this.sends.push(message);
          return Promise.resolve("ok");
        },
        emit(type, event, value = {}) {
          this.handlers
            .filter((h) => h.type === type && h.event === event)
            .forEach((h) => h.handler(value));
        },
      };
      channels.set(topic, channel);
      return channel;
    },
    removeChannel(channel) {
      removed.push(channel);
      channel.status?.("CLOSED");
      return Promise.resolve("ok");
    },
  };
  const { WorldTransport } = loadSource(
    "src/lib/multiplayer/WorldTransport.ts",
    {},
    {
      setInterval: (callback) => {
        timers.set(++timerId, callback);
        return timerId;
      },
      clearInterval: (id) => timers.delete(id),
    },
  );
  const { discoveryTopic, playerTopic } = loadSource(
    "src/lib/multiplayer/protocol.ts",
  );
  const transport = new WorldTransport(
    client,
    { id: A, nickname: "판다", worldKey: "panda-village" },
    {
      addMessage: (message) => messages.push(message),
      removePlayer() {},
      reset: () => {
        messages.length = 0;
      },
    },
    () => now,
  );
  return {
    transport,
    channels,
    timers,
    messages,
    removed,
    client,
    discoveryTopic,
    playerTopic,
    tick: (ms) => {
      now += ms;
    },
    async connect() {
      transport.activate();
      await settle();
      channels.get(discoveryTopic).status("SUBSCRIBED");
      assert.equal(transport.getSnapshot().connectionStatus, "connecting");
      channels.get(playerTopic(A)).status("SUBSCRIBED");
      await settle();
      assert.equal(transport.getSnapshot().connectionStatus, "connected");
    },
    peer(id = B, metas = [{ nickname: "사칭된 presence", x: 123 }]) {
      const root = channels.get(discoveryTopic);
      root.state = { ...root.state, [id]: metas };
      root.emit("presence", "sync");
      return channels.get(playerTopic(id));
    },
  };
}
test("discovery presence cannot create a player or overwrite an authenticated pose", async () => {
  const h = harness();
  await h.connect();
  const peer = h.peer();
  assert.equal(h.transport.getSnapshot().remotePlayerIds.length, 0);
  peer.emit("broadcast", "move", {
    payload: { id: A, nickname: "밤톨", x: 3, y: 0, z: 4, ry: 0, anim: "Idle" },
  });
  assert.equal(h.transport.getPlayerData(B).id, B);
  assert.equal(h.transport.getPlayerData(A), undefined);
  assert.equal(h.transport.getPlayerData(B).x, 3);
  h.peer();
  assert.equal(h.transport.getPlayerData(B).nickname, "밤톨");
  h.transport.deactivate();
});
test("chat identity is bound to the authorized topic even when the body claims another ID", async () => {
  const h = harness();
  await h.connect();
  const peer = h.peer();
  peer.emit("broadcast", "chat", {
    payload: { id: A, nickname: "밤톨", message: "인사" },
  });
  assert.equal(h.messages[0].id, B);
  peer.emit("broadcast", "chat", { payload: { id: A, message: "너무 빠름" } });
  assert.equal(h.messages.length, 1);
  h.tick(300);
  peer.emit("broadcast", "chat", { payload: { message: "두 번째" } });
  assert.equal(h.messages.length, 2);
  h.channels
    .get(h.discoveryTopic)
    .emit("broadcast", "chat", { payload: { id: A, message: "옛 프로토콜" } });
  assert.equal(h.messages.length, 2);
  h.transport.deactivate();
});
test("one tab leaving does not remove a peer with remaining presence metas", async () => {
  const h = harness();
  await h.connect();
  const peer = h.peer(B, [{}, {}]);
  peer.emit("broadcast", "move", { payload: { x: 5 } });
  h.channels.get(h.discoveryTopic).emit("presence", "leave", { key: B });
  h.peer(B, [{}]);
  assert(h.transport.getPlayerData(B));
  const root = h.channels.get(h.discoveryTopic);
  root.state = {};
  root.emit("presence", "sync");
  assert.equal(h.transport.getPlayerData(B), undefined);
  assert(h.removed.includes(peer));
  h.transport.deactivate();
});
test("late join heartbeat sends the latest pose; cleanup cancels every channel and timer", async () => {
  const h = harness();
  await h.connect();
  const peer = h.peer();
  const own = h.channels.get(h.playerTopic(A));
  const pose = { x: 9, y: 0, z: 2, ry: 1, anim: "Idle" };
  h.transport.broadcastMove(pose);
  pose.x = 100;
  [...h.timers.values()][0]();
  assert.equal(own.sends.at(-1).payload.x, 9);
  assert.equal(own.sends.at(-1).payload.id, undefined);
  h.transport.deactivate();
  assert.equal(h.timers.size, 0);
  assert.equal(h.removed.length, 3);
  peer.emit("broadcast", "move", { payload: { x: 3 } });
  assert.equal(h.transport.getSnapshot().remotePlayerIds.length, 0);
});
test("an auth/identity mismatch never opens a publication channel", async () => {
  const h = harness({ user: { id: B }, access_token: "test-only-token" });
  h.transport.activate();
  await settle();
  assert.equal(h.transport.getSnapshot().connectionStatus, "error");
  assert.equal(h.channels.size, 0);
  h.transport.deactivate();
});
test("deactivation cancels auth work and stale callbacks before reactivation", async () => {
  const h = harness();
  let finish;
  h.client.auth.getSession = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  h.transport.activate();
  h.transport.deactivate();
  finish({
    data: { session: { user: { id: A }, access_token: "test" } },
    error: null,
  });
  await settle();
  assert.equal(h.channels.size, 0);
});
test("both publication and discovery readiness are required and can recover after an error", async () => {
  const h = harness();
  await h.connect();
  h.peer().emit("broadcast", "move", { payload: { x: 3 } });
  const own = h.channels.get(h.playerTopic(A));
  own.status("CHANNEL_ERROR");
  assert.equal(h.transport.getSnapshot().connectionStatus, "error");
  assert.equal(h.timers.size, 0);
  assert.equal(h.transport.getSnapshot().remotePlayerIds.length, 0);
  own.status("SUBSCRIBED");
  await settle();
  assert.equal(h.transport.getSnapshot().connectionStatus, "connected");
  assert.equal(h.timers.size, 1);
  h.transport.deactivate();
});
test("malformed poses are sanitized and invalid IDs/empty chats are rejected", () => {
  const { decodeMove, decodeChat } = loadSource(
    "src/lib/multiplayer/protocol.ts",
  );
  const pose = decodeMove(
    B,
    { x: Infinity, z: NaN, y: -99, ry: "bad", anim: "invalid" },
    5,
  );
  assert.equal(pose.x, 0);
  assert.equal(pose.y, 0);
  assert.equal(pose.ry, 0);
  assert.equal(decodeMove("arbitrary", {}, 5), null);
  assert.equal(decodeChat(B, { message: "  " }, 5), null);
});
