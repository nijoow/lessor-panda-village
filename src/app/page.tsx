"use client";

import {
  KeyboardControls,
  KeyboardControlsEntry,
  useProgress,
} from "@react-three/drei";
import { AnimatePresence } from "framer-motion";
import { Scene } from "@/components/Scene";
import { Ground } from "@/components/world/Ground";
import { Player, Controls } from "@/components/world/Player";
import { Environment } from "@/components/world/Environment";
import { House } from "@/components/world/House";
import { PetalParticles, FireflyParticles } from "@/components/world/Particles";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { NicknameOverlay } from "@/components/ui/NicknameOverlay";
import { ChatHUD } from "@/components/ui/ChatHUD";
import { RemotePlayer } from "@/components/world/RemotePlayer";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import * as THREE from "three";

const keyboardMap: KeyboardControlsEntry<Controls>[] = [
  { name: Controls.forward, keys: ["ArrowUp", "KeyW"] },
  { name: Controls.backward, keys: ["ArrowDown", "KeyS"] },
  { name: Controls.left, keys: ["ArrowLeft", "KeyA"] },
  { name: Controls.right, keys: ["ArrowRight", "KeyD"] },
  { name: Controls.run, keys: ["ShiftLeft", "ShiftRight"] },
  { name: Controls.jump, keys: ["Space"] },
  { name: Controls.interact, keys: ["KeyE"] },
];

export default function Home() {
  const [isNight, setIsNight] = useState(false);
  const playerRef = useRef<THREE.Group>(null!);

  // 1. 자동 낮밤 전환 (45초 주기 - UI 동기화용)
  useEffect(() => {
    const interval = setInterval(() => {
      setIsNight((prev) => !prev);
    }, 30000); // 30초 주기로 낮/밤 전환 (전체 주기는 60초)
    return () => clearInterval(interval);
  }, []);

  return (
    <KeyboardControls map={keyboardMap}>
      <HomeContent isNight={isNight} playerRef={playerRef} />
    </KeyboardControls>
  );
}

interface HomeContentProps {
  isNight: boolean;
  setIsNight: React.Dispatch<React.SetStateAction<boolean>>;
  playerRef: React.MutableRefObject<THREE.Group>;
}

const HomeContent = ({
  isNight,
  playerRef,
}: Omit<HomeContentProps, "setIsNight">) => {
  const { progress } = useProgress();
  const [nickname, setNickname] = useState<string | null>(null);
  const [isChatFocused, setIsChatFocused] = useState(false);

  // 멀티플레이어 훅 (Zero-Rerender 아키텍처)
  const { remotePlayerIds, getPlayerData, broadcastMove, broadcastChat, myId } =
    useMultiplayer(nickname);

  // 로딩이 완료된 후에만 닉네임 입력창이 보이도록 함
  const showNicknameOverlay = progress === 100 && nickname === null;

  return (
    <main className="w-full h-full relative overflow-hidden bg-[#fdfaf6]">
      <LoadingScreen />

      <AnimatePresence>
        {showNicknameOverlay && (
          <NicknameOverlay onJoin={(name) => setNickname(name)} />
        )}
      </AnimatePresence>

      {nickname && (
        <ChatHUD
          onSendMessage={broadcastChat}
          onFocusChange={setIsChatFocused}
        />
      )}

      {/* UI layer - 닉네임 입력 후에만 표시 */}
      {nickname && (
        <div className="absolute top-10 left-0 w-full z-10 flex flex-col items-center pointer-events-none select-none ">
          <div className="bg-white/40 rounded-full backdrop-blur-xl py-2 px-4 drop-shadow-sm border-white/60 flex flex-col items-center">
            <h1 className="text-4xl font-black text-sky-900  flex items-center gap-3">
              래서판다 빌리지
              <Image
                src="/images/red_panda_icon.png"
                alt="Red Panda"
                width={40}
                height={40}
                className="rounded-full shadow-sm"
              />
            </h1>
            <p className="text-sky-800 font-bold  px-4 py-1 ">
              화살표/WASD: 이동 | SHIFT: 달리기 | SPACE: 점프
            </p>
          </div>
          <div
            className={`mt-4 px-6 py-2 rounded-full text-sm font-bold shadow-xl transition-all duration-1000 ${
              isNight
                ? "bg-indigo-950/80 text-yellow-300 ring-2 ring-yellow-400/30"
                : "bg-amber-100/80 text-orange-800 ring-2 ring-orange-500/30"
            }`}
          >
            {isNight ? "🌙 고요한 밤이에요" : "☀️ 화창한 낮이에요"}
          </div>
        </div>
      )}

      <Scene isNight={isNight}>
        <Ground />
        <Environment isNight={isNight} />
        <House position={[0, 4.5, -7]} rotation={[0, 0, 0]} scale={5} />
        <FireflyParticles />
        <PetalParticles />

        {/* 다른 플레이어들 렌더링 (Zero-Rerender 최적화) */}
        {remotePlayerIds.map((id) => (
          <RemotePlayer
            key={id}
            id={id}
            getPlayerData={getPlayerData}
          />
        ))}

        {/* Player - 닉네임이 있을 때만 활성화 */}
        {nickname && (
          <Player
            ref={playerRef}
            id={myId}
            nickname={nickname}
            onMove={broadcastMove}
            inputDisabled={isChatFocused}
          />
        )}
      </Scene>
    </main>
  );
};
