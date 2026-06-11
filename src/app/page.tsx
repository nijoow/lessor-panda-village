"use client";

import {
  KeyboardControls,
  KeyboardControlsEntry,
  useProgress,
} from "@react-three/drei";
import { AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";

import { Controls } from "@/components/world/Player";
import { VillageHeader } from "@/components/ui/VillageHeader";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { useDayNightCycle } from "@/hooks/useDayNightCycle";
import { useViewportHeight } from "@/hooks/useViewportHeight";

// ─────────────────────────────────────────────
// 다이나믹 임포트 (Lighthouse TBT & Render Blocking 최적화)
// ─────────────────────────────────────────────
const Scene = dynamic(
  () => import("@/components/Scene").then((mod) => mod.Scene),
  {
    ssr: false,
    loading: () => <div className="w-full h-full bg-[#fdfaf6]" />,
  },
);

const World = dynamic(
  () => import("@/components/world/World").then((mod) => mod.World),
  {
    ssr: false,
  },
);

const LoadingScreen = dynamic(
  () =>
    import("@/components/ui/LoadingScreen").then((mod) => mod.LoadingScreen),
  { ssr: false },
);

const NicknameOverlay = dynamic(
  () =>
    import("@/components/ui/NicknameOverlay").then(
      (mod) => mod.NicknameOverlay,
    ),
  { ssr: false },
);

const ChatHUD = dynamic(
  () => import("@/components/ui/ChatHUD").then((mod) => mod.ChatHUD),
  {
    ssr: false,
  },
);

const InteractionPrompt = dynamic(
  () =>
    import("@/components/ui/InteractionPrompt").then(
      (mod) => mod.InteractionPrompt,
    ),
  { ssr: false },
);

const EmoteBar = dynamic(
  () => import("@/components/ui/EmoteBar").then((mod) => mod.EmoteBar),
  { ssr: false },
);

const keyboardMap: KeyboardControlsEntry<Controls>[] = [
  { name: Controls.forward, keys: ["ArrowUp", "KeyW"] },
  { name: Controls.backward, keys: ["ArrowDown", "KeyS"] },
  { name: Controls.left, keys: ["ArrowLeft", "KeyA"] },
  { name: Controls.right, keys: ["ArrowRight", "KeyD"] },
  { name: Controls.run, keys: ["ShiftLeft", "ShiftRight"] },
  { name: Controls.jump, keys: ["Space"] },
  { name: Controls.interact, keys: ["KeyE"] },
  { name: Controls.emoteWave, keys: ["Digit1"] },
  { name: Controls.emoteDance, keys: ["Digit2"] },
];

// 로딩 100% 도달 후 입장 화면 표시까지의 지연 (사용자가 100%를 볼 수 있도록)
const LOADING_COMPLETE_DELAY_MS = 1500;

export default function Home() {
  const isNight = useDayNightCycle();
  const playerRef = useRef<THREE.Group>(null!);

  useViewportHeight();

  return (
    <KeyboardControls map={keyboardMap}>
      <HomeContent isNight={isNight} playerRef={playerRef} />
    </KeyboardControls>
  );
}

interface HomeContentProps {
  isNight: boolean;
  playerRef: React.MutableRefObject<THREE.Group>;
}

const HomeContent = ({ isNight, playerRef }: HomeContentProps) => {
  const { progress } = useProgress();
  const [nickname, setNickname] = useState<string | null>(null);
  const [isChatFocused, setIsChatFocused] = useState(false);
  const [isAssetsReady, setIsAssetsReady] = useState(false);

  useEffect(() => {
    if (progress === 100) {
      const timer = setTimeout(() => {
        setIsAssetsReady(true);
      }, LOADING_COMPLETE_DELAY_MS);
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

      {nickname !== null && (
        <>
          <ChatHUD
            onSendMessage={broadcastChat}
            onFocusChange={setIsChatFocused}
          />
          <InteractionPrompt />
          <EmoteBar />
          <VillageHeader isNight={isNight} />
        </>
      )}

      <Scene isNight={isNight}>
        <World
          isNight={isNight}
          nickname={nickname}
          isChatFocused={isChatFocused}
          playerRef={playerRef}
          remotePlayerIds={remotePlayerIds}
          getPlayerData={getPlayerData}
          broadcastMove={broadcastMove}
          myId={myId}
        />
      </Scene>
    </main>
  );
};
