import { useCallback, useEffect, useRef, useState } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { PLAYER_ANIM } from "@/constants/playerAnimations";
import { supabase } from "@/lib/supabase";
import { useChatStore } from "@/stores/chatStore";
import {
  MultiplayerConnectionStatus,
  PlayerState,
} from "@/types/multiplayer";

export const MAX_CHAT_LENGTH = 100;
export const MAX_NICKNAME_LENGTH = 10;

// presence로 공유되는 데이터 형상 (수신 값은 신뢰할 수 없으므로 optional)
interface PresencePayload {
  nickname?: string;
  x?: number;
  y?: number;
  z?: number;
  ry?: number;
  anim?: string;
  online_at?: string;
}

// 네트워크로 수신한 값은 항상 정제 후 사용
const toFinite = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const sanitizeNickname = (value: unknown): string =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim().slice(0, MAX_NICKNAME_LENGTH)
    : "Unknown";

const VALID_ANIMS = new Set<string>(Object.values(PLAYER_ANIM));

const sanitizeAnim = (value: unknown): string =>
  typeof value === "string" && VALID_ANIMS.has(value)
    ? value
    : PLAYER_ANIM.IDLE;

export const useMultiplayer = (
  nickname: string | null,
  worldKey: string | null,
  myId: string | null,
) => {
  const [remotePlayerIds, setRemotePlayerIds] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<MultiplayerConnectionStatus>("idle");
  // 방명록이 다시 읽어야 한다는 신호만 세는 카운터 (내용은 담지 않는다)
  const [guestbookRevision, setGuestbookRevision] = useState(0);
  const playersDataRef = useRef<Map<string, PlayerState>>(new Map());
  const knownPresenceIdsRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isChannelReadyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const canConnect = Boolean(nickname && worldKey && myId);

    playersDataRef.current.clear();
    knownPresenceIdsRef.current.clear();
    useChatStore.getState().reset();
    queueMicrotask(() => {
      if (cancelled) return;
      setRemotePlayerIds([]);
      setConnectionStatus(canConnect ? "connecting" : "idle");
    });

    if (!canConnect || !nickname || !worldKey || !myId) {
      return () => {
        cancelled = true;
      };
    }

    let channel: RealtimeChannel | null = null;

    const connect = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (cancelled) return;
      if (error || !session) {
        setConnectionStatus("error");
        return;
      }

      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase.channel(`world:${worldKey}`, {
        config: {
          private: true,
          // ack는 send()가 돌려주는 Promise로만 쓸모가 있는데 아래 세 곳 모두
          // 결과를 쓰지 않는다. 켜 두면 초당 최대 10건의 이동 브로드캐스트마다
          // 읽지도 않는 서버 응답을 하나씩 더 받게 된다.
          presence: { key: myId },
        },
      });
      channelRef.current = channel;

      channel
        .on("presence", { event: "sync" }, () => {
          if (!channel) return;

          const state = channel.presenceState<PresencePayload>();
          const currentKeys = Object.keys(state);
          const newIds: string[] = [];
          knownPresenceIdsRef.current = new Set(currentKeys);

          currentKeys.forEach((key) => {
            if (key === myId) return;
            newIds.push(key);

            const presence = state[key]?.[0];
            if (!presence) return;

            const existing = playersDataRef.current.get(key);

            if (existing) {
              // presence 위치는 최초 입장 값이므로 move로 갱신된 위치를 보존한다.
              existing.nickname = sanitizeNickname(presence.nickname);
            } else {
              playersDataRef.current.set(key, {
                id: key,
                nickname: sanitizeNickname(presence.nickname),
                x: toFinite(presence.x),
                y: toFinite(presence.y),
                z: toFinite(presence.z),
                ry: toFinite(presence.ry),
                anim: sanitizeAnim(presence.anim),
                lastUpdated: Date.now(),
              });
            }
          });

          for (const key of playersDataRef.current.keys()) {
            if (!currentKeys.includes(key)) {
              playersDataRef.current.delete(key);
              useChatStore.getState().removePlayer(key);
            }
          }

          setRemotePlayerIds((previous) => {
            if (
              previous.length === newIds.length &&
              previous.every((value, index) => value === newIds[index])
            ) {
              return previous;
            }
            return newIds;
          });
        })
        .on("presence", { event: "leave" }, ({ key }) => {
          knownPresenceIdsRef.current.delete(key);
          playersDataRef.current.delete(key);
          useChatStore.getState().removePlayer(key);
          setRemotePlayerIds((previous) =>
            previous.filter((id) => id !== key),
          );
        })
        .on("broadcast", { event: "move" }, ({ payload }) => {
          if (
            !payload ||
            typeof payload.id !== "string" ||
            payload.id === myId ||
            !knownPresenceIdsRef.current.has(payload.id)
          ) {
            return;
          }

          playersDataRef.current.set(payload.id, {
            id: payload.id,
            nickname: sanitizeNickname(payload.nickname),
            x: toFinite(payload.x),
            y: toFinite(payload.y),
            z: toFinite(payload.z),
            ry: toFinite(payload.ry),
            anim: sanitizeAnim(payload.anim),
            lastUpdated: Date.now(),
          });
        })
        // broadcast는 위조될 수 있으므로 payload를 쓰지 않고 재조회만 유발한다.
        // 실제 쪽지 내용은 항상 RLS가 걸린 데이터베이스에서 다시 읽는다.
        .on("broadcast", { event: "guestbook" }, () => {
          setGuestbookRevision((revision) => revision + 1);
        })
        .on("broadcast", { event: "chat" }, ({ payload }) => {
          if (
            !payload ||
            typeof payload.id !== "string" ||
            typeof payload.message !== "string" ||
            !knownPresenceIdsRef.current.has(payload.id)
          ) {
            return;
          }

          useChatStore.getState().addMessage({
            id: payload.id,
            nickname: sanitizeNickname(payload.nickname),
            message: payload.message.slice(0, MAX_CHAT_LENGTH),
            timestamp: Date.now(),
          });
        })
        .subscribe(async (status) => {
          if (cancelled || !channel) return;

          if (status === "SUBSCRIBED") {
            isChannelReadyRef.current = true;
            setConnectionStatus("connected");
            await channel.track({
              nickname,
              x: 0,
              y: 0,
              z: 0,
              ry: 0,
              anim: PLAYER_ANIM.IDLE,
              online_at: new Date().toISOString(),
            });
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            isChannelReadyRef.current = false;
            setConnectionStatus("error");
          }
        });
    };

    void connect().catch(() => {
      if (!cancelled) setConnectionStatus("error");
    });

    return () => {
      cancelled = true;
      isChannelReadyRef.current = false;
      knownPresenceIdsRef.current.clear();

      if (channelRef.current === channel) {
        channelRef.current = null;
      }
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [nickname, worldKey, myId]);

  const broadcastMove = useCallback(
    (state: Omit<PlayerState, "id" | "nickname" | "lastUpdated">) => {
      if (
        !channelRef.current ||
        !nickname ||
        !myId ||
        !isChannelReadyRef.current
      ) {
        return;
      }

      void channelRef.current.send({
        type: "broadcast",
        event: "move",
        payload: {
          id: myId,
          nickname,
          ...state,
        },
      });
    },
    [nickname, myId],
  );

  const broadcastChat = useCallback(
    (message: string) => {
      if (
        !channelRef.current ||
        !nickname ||
        !myId ||
        !isChannelReadyRef.current
      ) {
        return;
      }

      const payload = {
        id: myId,
        nickname,
        message: message.slice(0, MAX_CHAT_LENGTH),
      };

      void channelRef.current.send({
        type: "broadcast",
        event: "chat",
        payload,
      });

      // 브로드캐스트 self 수신은 끄고 로컬 메시지를 즉시 표시한다.
      useChatStore.getState().addMessage({
        ...payload,
        timestamp: Date.now(),
      });
    },
    [nickname, myId],
  );

  const broadcastGuestbook = useCallback(() => {
    if (!channelRef.current || !isChannelReadyRef.current) return;

    void channelRef.current.send({
      type: "broadcast",
      event: "guestbook",
      payload: {},
    });
  }, []);

  const getPlayerData = useCallback(
    (id: string) => playersDataRef.current.get(id),
    [],
  );

  return {
    remotePlayerIds,
    connectionStatus,
    guestbookRevision,
    getPlayerData,
    broadcastMove,
    broadcastChat,
    broadcastGuestbook,
  };
};
