"use client";

import { Environment } from "@/components/world/Environment";
import { Ground } from "@/components/world/Ground";
import { House } from "@/components/world/House";
import { PetalParticles, FireflyParticles } from "@/components/world/Particles";
import { Player } from "@/components/world/Player";
import { RemotePlayer } from "@/components/world/RemotePlayer";
import { PlayerState } from "@/hooks/useMultiplayer";
import * as THREE from "three";

interface WorldProps {
  isNight: boolean;
  nickname: string | null;
  playerRef: React.MutableRefObject<THREE.Group>;
  isChatFocused: boolean;
  remotePlayerIds: string[];
  getPlayerData: (id: string) => PlayerState | undefined;
  myId: string;
  broadcastMove: (
    state: Omit<PlayerState, "id" | "nickname" | "lastUpdated">,
  ) => void;
}

export const World = ({
  isNight,
  nickname,
  playerRef,
  isChatFocused,
  remotePlayerIds,
  getPlayerData,
  myId,
  broadcastMove,
}: WorldProps) => {
  return (
    <>
      <Ground disableClick={isChatFocused} />
      <Environment isNight={isNight} />
      <House position={[0, 4.5, -7]} rotation={[0, 0, 0]} scale={5} />
      <FireflyParticles isNight={isNight} />
      <PetalParticles isNight={isNight} />

      {/* 다른 플레이어들 렌더링 (Zero-Rerender 최적화) */}
      {remotePlayerIds.map((id) => (
        <RemotePlayer key={id} id={id} getPlayerData={getPlayerData} />
      ))}

      {/* Player - 닉네임이 있을 때만 활성화 */}
      {nickname && (
        <Player
          ref={playerRef}
          id={myId}
          nickname={nickname as string}
          onMove={broadcastMove}
          inputDisabled={isChatFocused}
        />
      )}
    </>
  );
};
