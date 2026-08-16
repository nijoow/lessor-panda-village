"use client";

import { Environment } from "@/components/world/Environment";
import { Ground } from "@/components/world/Ground";
import { House } from "@/components/world/House";
import { NoticeBoards } from "@/components/world/NoticeBoard";
import { NPCPanda } from "@/components/world/NPCPanda";
import { NPCS } from "@/constants/npcs";
import { PetalParticles, FireflyParticles } from "@/components/world/Particles";
import { Player } from "@/components/world/Player";
import { RemotePlayer } from "@/components/world/RemotePlayer";
import { PlayerState } from "@/types/multiplayer";
import { HOUSES } from "@/constants/world";
import * as THREE from "three";

interface WorldProps {
  isNight: boolean;
  nickname: string | null;
  playerRef: React.MutableRefObject<THREE.Group>;
  /** 채팅 입력 또는 방명록 패널이 열려 있어 플레이어 조작을 막아야 하는 상태 */
  inputLocked: boolean;
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
  inputLocked,
  remotePlayerIds,
  getPlayerData,
  myId,
  broadcastMove,
}: WorldProps) => {
  return (
    <>
      <Ground disableClick={inputLocked} />
      <Environment isNight={isNight} />
      {HOUSES.map((h, i) => (
        <House key={i} position={h.position} rotation={[0, 0, 0]} scale={h.scale} />
      ))}
      <NoticeBoards isNight={isNight} />
      <FireflyParticles isNight={isNight} />
      <PetalParticles isNight={isNight} />

      {/* 배회 NPC 판다들 */}
      {NPCS.map((npc) => (
        <NPCPanda key={npc.id} spec={npc} />
      ))}

      {/* 다른 플레이어들 렌더링 (Zero-Rerender 최적화) */}
      {remotePlayerIds.map((id) => (
        <RemotePlayer key={id} id={id} getPlayerData={getPlayerData} />
      ))}

      {/* Player - 닉네임이 있을 때만 활성화 */}
      {nickname !== null ? (
        <Player
          ref={playerRef}
          id={myId}
          nickname={nickname}
          onMove={broadcastMove}
          inputDisabled={inputLocked}
        />
      ) : null}
    </>
  );
};
