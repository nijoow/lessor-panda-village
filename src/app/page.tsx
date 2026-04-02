"use client";

import {
  KeyboardControls,
  KeyboardControlsEntry,
  useProgress,
} from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
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

  // 1. 모바일 브라우저 상/하단바 높이 계산 (100vh 이슈 해결)
  useEffect(() => {
    const updateVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };

    updateVh();
    window.addEventListener("resize", updateVh);
    return () => window.removeEventListener("resize", updateVh);
  }, []);

  // 2. 자동 낮밤 전환 (45초 주기 - UI 동기화용)
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
  const [isAssetsReady, setIsAssetsReady] = useState(false);

  // 로딩 완료 후 지연 처리 (사용자가 100%를 볼 수 있도록)
  useEffect(() => {
    if (progress === 100) {
      const timer = setTimeout(() => {
        setIsAssetsReady(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [progress]);

  // 멀티플레이어 훅 (Zero-Rerender 아키텍처)
  const { remotePlayerIds, getPlayerData, broadcastMove, broadcastChat, myId } =
    useMultiplayer(nickname);

  // 로딩과 지연 처리가 모두 끝난 후에만 닉네임 입력창이 보이도록 함
  const showNicknameOverlay = isAssetsReady && nickname === null;

  return (
    <main className="w-full h-full relative overflow-hidden bg-[#fdfaf6]">
      <LoadingScreen visible={!isAssetsReady} />

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
        <div className="absolute top-4 sm:top-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 sm:gap-4 w-full px-4 text-center z-10 pointer-events-none select-none">
          <div className="flex flex-col items-center px-12 py-2.5 bg-white/40 rounded-full gap-2 backdrop-blur-xl drop-shadow-sm border-white/60 border">
            <motion.h1
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-2xl sm:text-4xl font-black text-sky-950 drop-shadow-sm flex items-center gap-1.5 sm:gap-3"
            >
              래서판다 빌리지
              <div className="relative size-6 sm:size-10 shadow-sm rounded-full overflow-hidden">
                <Image src="/images/red_panda_icon.png" alt="Red Panda" fill />
              </div>
            </motion.h1>
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center gap-1 sm:gap-2"
            >
              <p className="hidden sm:block text-sky-900/60 text-xs sm:text-sm font-bold tracking-widest">
                화살표/WASD: 이동 | SHIFT: 달리기 | SPACE: 점프
              </p>
              <p className="block sm:hidden text-sky-900/60 text-sm font-bold tracking-widest">
                터치 또는 클릭으로 이동할 수 있어요!
              </p>
            </motion.div>
          </div>
          <div
            className={`px-6 py-2 rounded-full text-sm font-bold shadow-xl transition-all duration-1000 ${
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
        <Ground disableClick={isChatFocused} />
        <Environment isNight={isNight} />
        <House position={[0, 4.5, -7]} rotation={[0, 0, 0]} scale={5} />
        <FireflyParticles />
        <PetalParticles />

        {/* 다른 플레이어들 렌더링 (Zero-Rerender 최적화) */}
        {remotePlayerIds.map((id) => (
          <RemotePlayer key={id} id={id} getPlayerData={getPlayerData} />
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
