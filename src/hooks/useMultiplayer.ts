import { useEffect, useState, useRef } from 'react';
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

export const useMultiplayer = (nickname: string | null) => {
  const [remotePlayerIds, setRemotePlayerIds] = useState<string[]>([]);
  const playersDataRef = useRef<Map<string, PlayerState>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [myId] = useState(() => Math.random().toString(36).substring(7));

  useEffect(() => {
    if (!nickname) return;

    console.log('[Multiplayer] Connecting with nickname:', nickname);

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
        Object.keys(state).forEach((key) => {
          if (key === myId) return;
          newIds.push(key);
          
          const presences = state[key] as unknown as (PlayerState & { online_at: string })[];
          if (presences.length > 0 && !playersDataRef.current.has(key)) {
            const p = presences[0];
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
        
        setRemotePlayerIds(newIds);
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        console.log('[Multiplayer] Player left:', key);
        playersDataRef.current.delete(key);
        setRemotePlayerIds((prev) => prev.filter(id => id !== key));
      });

    channel.on('broadcast', { event: 'move' }, ({ payload }) => {
      if (payload.id === myId) return;

      playersDataRef.current.set(payload.id, {
        ...payload,
        lastUpdated: Date.now(),
      });
    });

    channel.subscribe(async (status) => {
      console.log('[Multiplayer] Channel status:', status);
      if (status === 'SUBSCRIBED') {
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
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [nickname, myId]);

  const broadcastMove = (state: Omit<PlayerState, 'id' | 'nickname' | 'lastUpdated'>) => {
    if (!channelRef.current || !nickname) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'move',
      payload: {
        id: myId,
        nickname,
        ...state,
      },
    });
  };

  const getPlayerData = (id: string) => playersDataRef.current.get(id);

  return {
    remotePlayerIds,
    getPlayerData,
    broadcastMove,
    myId,
  };
};
