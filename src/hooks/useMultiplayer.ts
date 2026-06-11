import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
import { PLAYER_ANIM } from "@/constants/playerAnimations";
import { PlayerState } from "@/types/multiplayer";
import { useChatStore } from "@/stores/chatStore";

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
const toFinite = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const sanitizeNickname = (v: unknown): string =>
  typeof v === "string" && v.trim().length > 0
    ? v.trim().slice(0, MAX_NICKNAME_LENGTH)
    : "Unknown";

const VALID_ANIMS = new Set<string>(Object.values(PLAYER_ANIM));

const sanitizeAnim = (v: unknown): string =>
  typeof v === "string" && VALID_ANIMS.has(v) ? v : PLAYER_ANIM.IDLE;

export const useMultiplayer = (nickname: string | null) => {
  const [remotePlayerIds, setRemotePlayerIds] = useState<string[]>([]);
  const playersDataRef = useRef<Map<string, PlayerState>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [myId] = useState(() => crypto.randomUUID());
  const isChannelReadyRef = useRef(false);

  useEffect(() => {
    if (!nickname) return;

    const channel = supabase.channel("village", {
      config: {
        presence: { key: myId },
      },
    });

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresencePayload>();

        const newIds: string[] = [];
        const currentKeys = Object.keys(state);

        currentKeys.forEach((key) => {
          if (key === myId) return;
          newIds.push(key);

          const presence = state[key]?.[0];
          if (!presence) return;

          const existing = playersDataRef.current.get(key);

          if (existing) {
            // presence의 위치는 입장 시점(track 호출) 값이라 stale함.
            // 이미 move 브로드캐스트로 받은 위치를 덮어쓰지 않고 닉네임만 갱신.
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

        // state에 없는 (나간) 유저의 데이터는 Map에서 정리
        for (const key of playersDataRef.current.keys()) {
          if (!currentKeys.includes(key)) {
            playersDataRef.current.delete(key);
            useChatStore.getState().removePlayer(key);
          }
        }

        setRemotePlayerIds((prev) => {
          if (
            prev.length === newIds.length &&
            prev.every((v, i) => v === newIds[i])
          ) {
            return prev;
          }
          return newIds;
        });
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        // Map 정리는 sync 이벤트에서 완벽하게 처리되므로,
        // leave 이벤트에서는 즉각적인 UI 반영을 위해 state만 업데이트
        setRemotePlayerIds((prev) => prev.filter((id) => id !== key));
      });

    channel.on("broadcast", { event: "move" }, ({ payload }) => {
      if (!payload || typeof payload.id !== "string" || payload.id === myId)
        return;

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
    });

    channel.on("broadcast", { event: "chat" }, ({ payload }) => {
      if (
        !payload ||
        typeof payload.id !== "string" ||
        typeof payload.message !== "string"
      )
        return;

      useChatStore.getState().addMessage({
        id: payload.id,
        nickname: sanitizeNickname(payload.nickname),
        message: payload.message.slice(0, MAX_CHAT_LENGTH),
        timestamp: Date.now(),
      });
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        isChannelReadyRef.current = true;
        await channel.track({
          id: myId,
          nickname,
          x: 0,
          y: 0,
          z: 0,
          ry: 0,
          anim: PLAYER_ANIM.IDLE,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      isChannelReadyRef.current = false;
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [nickname, myId]);

  const broadcastMove = useCallback(
    (state: Omit<PlayerState, "id" | "nickname" | "lastUpdated">) => {
      if (!channelRef.current || !nickname || !isChannelReadyRef.current)
        return;

      channelRef.current.send({
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
      if (!channelRef.current || !nickname || !isChannelReadyRef.current)
        return;

      const payload = {
        id: myId,
        nickname,
        message: message.slice(0, MAX_CHAT_LENGTH),
      };

      channelRef.current.send({
        type: "broadcast",
        event: "chat",
        payload,
      });

      // 로컬에서도 처리 (본인이 보낸 메시지)
      useChatStore.getState().addMessage({
        ...payload,
        timestamp: Date.now(),
      });
    },
    [nickname, myId],
  );

  const getPlayerData = useCallback(
    (id: string) => playersDataRef.current.get(id),
    [],
  );

  return {
    remotePlayerIds,
    getPlayerData,
    broadcastMove,
    broadcastChat,
    myId,
  };
};
