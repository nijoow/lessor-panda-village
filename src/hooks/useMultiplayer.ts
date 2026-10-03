import { useEffect, useMemo, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { WorldTransport } from "@/lib/multiplayer/WorldTransport";
import { useChatStore } from "@/stores/chatStore";

export const useMultiplayer = (
  nickname: string | null,
  worldKey: string | null,
  myId: string | null,
  retryKey = 0,
) => {
  const transport = useMemo(
    () =>
      new WorldTransport(
        supabase,
        nickname && worldKey && myId ? { id: myId, nickname, worldKey } : null,
        {
          addMessage: (message) => useChatStore.getState().addMessage(message),
          removePlayer: (id) => useChatStore.getState().removePlayer(id),
          reset: () => useChatStore.getState().reset(),
        },
      ),
    [nickname, worldKey, myId],
  );
  const snapshot = useSyncExternalStore(
    transport.subscribe,
    transport.getSnapshot,
    transport.getSnapshot,
  );
  useEffect(() => {
    transport.activate();
    return transport.deactivate;
  }, [transport, retryKey]);
  return {
    ...snapshot,
    getPlayerData: transport.getPlayerData,
    broadcastMove: transport.broadcastMove,
    broadcastChat: transport.broadcastChat,
    broadcastGuestbook: transport.broadcastGuestbook,
  };
};
