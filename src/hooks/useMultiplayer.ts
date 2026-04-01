import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PLAYER_ANIM } from '@/constants/playerAnimations';

// 플레이어 상태 정의
export interface PlayerState {
  id: string;
  nickname: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  anim: string;
  lastUpdated: number;
}

export interface ChatMessage {
  id: string;
  nickname: string;
  message: string;
  timestamp: number;
}

export const useMultiplayer = (
  nickname: string | null,
  onChatMessage?: (chat: ChatMessage) => void,
) => {
  const [remotePlayerIds, setRemotePlayerIds] = useState<string[]>([]);
  const playersDataRef = useRef<Map<string, PlayerState>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [myId] = useState(() => Math.random().toString(36).substring(7));
  const onChatMessageRef = useRef(onChatMessage);
  const isChannelReadyRef = useRef(false);

  // 콜백 레퍼런스 최신화 (Effect 재실행 방지용)
  useEffect(() => {
    onChatMessageRef.current = onChatMessage;
  }, [onChatMessage]);

  useEffect(() => {
    if (!nickname) return;

    console.log(`[Multiplayer] Connecting: ${nickname} (${myId})`);

    const channel = supabase.channel('village', {
      config: {
        presence: { key: myId },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        console.log('[Multiplayer] Presence Sync:', state);
        
        const newIds: string[] = [];
        const currentKeys = Object.keys(state);

        currentKeys.forEach((key) => {
          if (key === myId) return;
          newIds.push(key);
          
          const presences = state[key] as unknown as (PlayerState & { online_at: string })[];
          if (presences.length > 0) {
            const p = presences[0];
            // 항상 최신 정보로 갱신 (닉네임 변경 등 대응)
            playersDataRef.current.set(key, {
              id: key,
              nickname: p.nickname || 'Unknown',
              x: p.x || 0,
              y: p.y || 0,
              z: p.z || 0,
              ry: p.ry || 0,
              anim: p.anim || PLAYER_ANIM.IDLE,
              lastUpdated: Date.now(),
            });
          }
        });

        // state에 없는 (나간) 유저의 데이터는 Map에서 정리
        for (const key of playersDataRef.current.keys()) {
          if (!currentKeys.includes(key)) {
            playersDataRef.current.delete(key);
          }
        }
        
        setRemotePlayerIds(newIds);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('[Multiplayer] Player left:', key, leftPresences);
        // Map 정리는 sync 이벤트에서 완벽하게 처리되므로, 
        // leave 이벤트에서는 즉각적인 UI 반영을 위해 state만 업데이트
        setRemotePlayerIds((prev) => prev.filter(id => id !== key));
      });

    channel.on('broadcast', { event: 'move' }, ({ payload }) => {
      if (payload.id === myId) return;

      playersDataRef.current.set(payload.id, {
        ...payload,
        lastUpdated: Date.now(),
      });
    });

    channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
      onChatMessageRef.current?.({
        ...payload,
        timestamp: Date.now(),
      });
    });

    channel.subscribe(async (status) => {
      console.log('[Multiplayer] Channel status:', status);
      if (status === 'SUBSCRIBED') {
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
      console.log('[Multiplayer] Unsubscribing...');
      isChannelReadyRef.current = false;
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [nickname, myId]);

  const broadcastMove = useCallback((state: Omit<PlayerState, 'id' | 'nickname' | 'lastUpdated'>) => {
    if (!channelRef.current || !nickname || !isChannelReadyRef.current) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'move',
      payload: {
        id: myId,
        nickname,
        ...state,
      },
    });
  }, [nickname, myId]);

  const broadcastChat = useCallback((message: string) => {
    if (!channelRef.current || !nickname || !isChannelReadyRef.current) return;

    const payload = {
      id: myId,
      nickname,
      message,
    };

    channelRef.current.send({
      type: 'broadcast',
      event: 'chat',
      payload,
    });

    // 로컬에서도 처리 (본인이 보낸 메시지)
    onChatMessageRef.current?.({
      ...payload,
      timestamp: Date.now(),
    });
  }, [nickname, myId]);

  const getPlayerData = useCallback((id: string) => playersDataRef.current.get(id), []);

  return {
    remotePlayerIds,
    getPlayerData,
    broadcastMove,
    broadcastChat,
    myId,
  };
};
