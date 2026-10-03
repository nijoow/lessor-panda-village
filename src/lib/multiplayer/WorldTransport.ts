import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { ClientDatabase } from "@/types/clientDatabase";
import type {
  ChatMessage,
  MultiplayerConnectionStatus,
  PlayerState,
} from "@/types/multiplayer";
import type { PlayerPose } from "@/domain/player";
import { GLOBAL_WORLD_KEY } from "@/domain/world";
import { PLAYER_ANIM } from "@/constants/playerAnimations";
import {
  decodeChat,
  decodeMove,
  discoveryTopic,
  isPlayerId,
  playerTopic,
} from "./protocol";

interface Snapshot {
  remotePlayerIds: string[];
  connectionStatus: MultiplayerConnectionStatus;
  guestbookRevision: number;
}
interface ChatPort {
  addMessage(message: ChatMessage): void;
  removePlayer(id: string): void;
  reset(): void;
}
interface Context {
  root: RealtimeChannel | null;
  own: RealtimeChannel | null;
  rootReady: boolean;
  ownReady: boolean;
  joining: boolean;
  heartbeat: ReturnType<typeof setInterval> | null;
  peers: Map<string, RealtimeChannel>;
  lastChatAt: Map<string, number>;
}

/** Owns channel/auth/heartbeat lifetimes. React only observes UI-sized changes. */
export class WorldTransport {
  private snapshot: Snapshot = {
    remotePlayerIds: [],
    connectionStatus: "idle",
    guestbookRevision: 0,
  };
  private listeners = new Set<() => void>();
  private players = new Map<string, PlayerState>();
  private context: Context | null = null;
  private latestPose: PlayerPose = {
    x: 0,
    y: 0,
    z: 0,
    ry: 0,
    anim: PLAYER_ANIM.IDLE,
  };

  constructor(
    private readonly client: SupabaseClient<ClientDatabase> | null,
    private readonly identity: {
      id: string;
      nickname: string;
      worldKey: string;
    } | null,
    private readonly chat: ChatPort,
    private readonly now = Date.now,
  ) {}

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getPlayerData = (id: string) => this.players.get(id);
  private update(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private current(context: Context) {
    return this.context === context;
  }
  private publishIds() {
    const ids = [...this.players.keys()].sort();
    if (
      ids.length !== this.snapshot.remotePlayerIds.length ||
      ids.some((id, index) => id !== this.snapshot.remotePlayerIds[index])
    )
      this.update({ remotePlayerIds: ids });
  }
  private dropPlayer(id: string) {
    this.players.delete(id);
    this.chat.removePlayer(id);
    this.publishIds();
  }
  private removePeers(context: Context) {
    for (const [id, channel] of context.peers) {
      void this.client?.removeChannel(channel);
      this.chat.removePlayer(id);
    }
    context.peers.clear();
    context.lastChatAt.clear();
    this.players.clear();
    this.publishIds();
  }
  activate = () => {
    this.deactivate();
    this.chat.reset();
    const identity = this.identity;
    if (
      !this.client ||
      !identity ||
      !isPlayerId(identity.id) ||
      identity.worldKey !== GLOBAL_WORLD_KEY
    )
      return;
    const context: Context = {
      root: null,
      own: null,
      rootReady: false,
      ownReady: false,
      joining: false,
      heartbeat: null,
      peers: new Map(),
      lastChatAt: new Map(),
    };
    this.context = context;
    this.update({ connectionStatus: "connecting" });
    void this.connect(context).catch(() => {
      if (this.current(context)) this.fail(context);
    });
  };
  deactivate = () => {
    const context = this.context;
    this.context = null;
    if (context) {
      if (context.heartbeat !== null) clearInterval(context.heartbeat);
      this.removePeers(context);
      if (context.root) void this.client?.removeChannel(context.root);
      if (context.own) void this.client?.removeChannel(context.own);
    }
    this.update({ connectionStatus: "idle", remotePlayerIds: [] });
  };
  private fail(context: Context) {
    if (context.heartbeat !== null) clearInterval(context.heartbeat);
    context.heartbeat = null;
    this.removePeers(context);
    this.update({ connectionStatus: "error" });
  }
  private async connect(context: Context) {
    const client = this.client!,
      identity = this.identity!;
    const {
      data: { session },
      error,
    } = await client.auth.getSession();
    if (!this.current(context)) return;
    if (error || !session || session.user.id !== identity.id) {
      this.fail(context);
      return;
    }
    await client.realtime.setAuth(session.access_token);
    if (!this.current(context)) return;
    context.root = client.channel(discoveryTopic, {
      config: { private: true, presence: { key: identity.id } },
    });
    context.own = client.channel(playerTopic(identity.id), {
      config: { private: true, broadcast: { ack: false, self: false } },
    });
    context.root
      .on("presence", { event: "sync" }, () => {
        if (this.current(context) && context.rootReady) this.syncPeers(context);
      })
      .on("broadcast", { event: "guestbook" }, () => {
        if (this.current(context))
          this.update({
            guestbookRevision: this.snapshot.guestbookRevision + 1,
          });
      })
      .subscribe((status) => this.channelStatus(context, "root", status));
    context.own.subscribe((status) =>
      this.channelStatus(context, "own", status),
    );
  }
  private channelStatus(
    context: Context,
    kind: "root" | "own",
    status: string,
  ) {
    if (!this.current(context)) return;
    if (status === "SUBSCRIBED") {
      if (kind === "root") context.rootReady = true;
      else context.ownReady = true;
      void this.ready(context).catch(() => {
        if (this.current(context)) this.fail(context);
      });
    } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
      if (kind === "root") context.rootReady = false;
      else context.ownReady = false;
      this.fail(context);
    }
  }
  private async ready(context: Context) {
    if (!context.rootReady || !context.ownReady || context.joining) return;
    context.joining = true;
    try {
      const result = await context.root!.track({
        online_at: new Date(this.now()).toISOString(),
      });
      if (!this.current(context) || !context.rootReady || !context.ownReady)
        return;
      if (result !== "ok") {
        this.fail(context);
        return;
      }
      this.update({
        connectionStatus: "connected",
        guestbookRevision: this.snapshot.guestbookRevision + 1,
      });
      this.syncPeers(context);
      this.sendLatest();
      if (context.heartbeat !== null) clearInterval(context.heartbeat);
      context.heartbeat = setInterval(() => this.sendLatest(), 2000);
    } finally {
      context.joining = false;
    }
  }
  private syncPeers(context: Context) {
    // Presence discovers candidates; it cannot create a player or choose a pose/name.
    // sync includes all tab metas: one tab leaving must not evict another tab.
    const candidates = new Set(
      Object.keys(context.root!.presenceState())
        .filter((id) => id !== this.identity!.id && isPlayerId(id))
        .slice(0, 64),
    );
    for (const [id, channel] of context.peers) {
      if (!candidates.has(id)) {
        context.peers.delete(id);
        context.lastChatAt.delete(id);
        void this.client!.removeChannel(channel);
        this.dropPlayer(id);
      }
    }
    for (const id of candidates) {
      if (context.peers.has(id)) continue;
      const channel = this.client!.channel(playerTopic(id), {
        config: { private: true },
      });
      context.peers.set(id, channel);
      const valid = () =>
        this.current(context) &&
        context.peers.get(id) === channel &&
        this.snapshot.connectionStatus === "connected";
      channel
        .on("broadcast", { event: "move" }, ({ payload }) => {
          if (!valid()) return;
          const player = decodeMove(id, payload, this.now());
          if (player) {
            this.players.set(id, player);
            this.publishIds();
          }
        })
        .on("broadcast", { event: "chat" }, ({ payload }) => {
          if (!valid()) return;
          const now = this.now(),
            message = decodeChat(id, payload, now);
          if (!message || now - (context.lastChatAt.get(id) ?? -Infinity) < 300)
            return;
          context.lastChatAt.set(id, now);
          this.chat.addMessage(message);
        })
        .subscribe((status) => {
          if (
            valid() &&
            ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)
          )
            this.dropPlayer(id);
        });
    }
  }
  private sendLatest() {
    const context = this.context;
    if (!context?.own || this.snapshot.connectionStatus !== "connected") return;
    void context.own.send({
      type: "broadcast",
      event: "move",
      payload: { nickname: this.identity!.nickname, ...this.latestPose },
    });
  }
  broadcastMove = (pose: PlayerPose) => {
    this.latestPose = { ...pose };
    this.sendLatest();
  };
  broadcastChat = (text: string) => {
    const context = this.context;
    if (!context?.own || this.snapshot.connectionStatus !== "connected") return;
    const identity = this.identity!,
      message = decodeChat(
        identity.id,
        { nickname: identity.nickname, message: text },
        this.now(),
      );
    if (!message) return;
    void context.own.send({
      type: "broadcast",
      event: "chat",
      payload: { nickname: message.nickname, message: message.message },
    });
    this.chat.addMessage(message);
  };
  broadcastGuestbook = () => {
    if (this.context?.root && this.snapshot.connectionStatus === "connected")
      void this.context.root.send({
        type: "broadcast",
        event: "guestbook",
        payload: {},
      });
  };
}
