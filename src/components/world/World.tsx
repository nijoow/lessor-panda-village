"use client";

import { Environment } from "@/components/world/Environment";
import { Ground } from "@/components/world/Ground";
import { House } from "@/components/world/House";
import { NoticeBoards } from "@/components/world/NoticeBoard";
import {
  PetalParticles,
  FireflyParticles,
  ButterflyParticles,
} from "@/components/world/Particles";
import { Player } from "@/components/world/Player";
import { RemotePlayer } from "@/components/world/RemotePlayer";
import type { PlayerPose } from "@/domain/player";
import { PlayerState } from "@/types/multiplayer";
import { HOUSES } from "@/constants/world";
import { Suspense, useRef } from "react";
import { useFrame } from "@react-three/fiber";

// 로컬 캐릭터와 같은 Suspense 안에서 첫 렌더가 끝난 뒤 입장을 완료한다.
const WorldReady = ({ onReady }: { onReady: () => void }) => {
  const frames = useRef(0);
  useFrame(() => {
    if (++frames.current === 2) onReady();
  });
  return null;
};

interface WorldProps {
  onReady: () => void;
  isNight: boolean;
  nickname: string | null;
  /** 채팅 입력 또는 방명록 패널이 열려 있어 플레이어 조작을 막아야 하는 상태 */
  inputLocked: boolean;
  remotePlayerIds: string[];
  getPlayerData: (id: string) => PlayerState | undefined;
  myId: string;
  broadcastMove: (
    state: PlayerPose,
  ) => void;
}

export const World = ({
  onReady,
  isNight,
  nickname,
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
      <ButterflyParticles isNight={isNight} />

      {/* 접속자 ID 목록으로 원격 플레이어 구성 */}
      <Suspense fallback={null}>
      {remotePlayerIds.map((id) => (
        <RemotePlayer key={id} id={id} getPlayerData={getPlayerData} />
      ))}
      </Suspense>

      {/* Player - 닉네임이 있을 때만 활성화 */}
      {nickname !== null ? (
        <Player
          id={myId}
          nickname={nickname}
          onMove={broadcastMove}
          inputDisabled={inputLocked}
        />
      ) : null}
      {nickname !== null && <WorldReady onReady={onReady} />}
    </>
  );
};
