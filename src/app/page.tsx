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
import { useGlobalWorld } from "@/hooks/useGlobalWorld";
import { useGuestbook } from "@/hooks/useGuestbook";
import { useDayNightCycle } from "@/hooks/useDayNightCycle";
import { useViewportHeight } from "@/hooks/useViewportHeight";
import { useGuestbookStore } from "@/stores/guestbookStore";
import { NOTICE_BOARDS } from "@/constants/world";
import { audio } from "@/lib/audio";

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

const ZoneBanner = dynamic(
  () => import("@/components/ui/ZoneBanner").then((mod) => mod.ZoneBanner),
  { ssr: false },
);

const Minimap = dynamic(
  () => import("@/components/ui/Minimap").then((mod) => mod.Minimap),
  { ssr: false },
);

const SoundToggle = dynamic(
  () => import("@/components/ui/SoundToggle").then((mod) => mod.SoundToggle),
  { ssr: false },
);

const InventoryHUD = dynamic(
  () => import("@/components/ui/InventoryHUD").then((mod) => mod.InventoryHUD),
  { ssr: false },
);

const WorldHUD = dynamic(
  () => import("@/components/ui/WorldHUD").then((mod) => mod.WorldHUD),
  { ssr: false },
);

const GuestbookPanel = dynamic(
  () =>
    import("@/components/ui/GuestbookPanel").then((mod) => mod.GuestbookPanel),
  { ssr: false },
);

// 현재 흔적 장소는 마을 게시판 하나뿐이다 (docs/roadmap.md)
const GUESTBOOK_PLACE_ID = NOTICE_BOARDS[0]?.placeId ?? "";

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
  const [isChatFocused, setIsChatFocused] = useState(false);
  const [isAssetsReady, setIsAssetsReady] = useState(false);
  const {
    worldSession,
    savedNickname,
    isReady: isWorldReady,
    isEntering,
    entryError,
    enterWorld,
  } = useGlobalWorld();

  useEffect(() => {
    if (progress === 100) {
      const timer = setTimeout(() => {
        setIsAssetsReady(true);
      }, LOADING_COMPLETE_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [progress]);

  // 낮밤 전환 시 앰비언스(새소리↔풀벌레) 크로스페이드
  useEffect(() => {
    audio.setNight(isNight);
  }, [isNight]);

  // 멀티플레이어 훅 (Zero-Rerender 아키텍처)
  const {
    remotePlayerIds,
    connectionStatus,
    guestbookRevision,
    getPlayerData,
    broadcastMove,
    broadcastChat,
    broadcastGuestbook,
  } = useMultiplayer(
    worldSession?.nickname ?? null,
    worldSession?.worldKey ?? null,
    worldSession?.userId ?? null,
  );

  const {
    submit: submitNote,
    remove: removeNote,
    isSubmitting: isWritingNote,
    writeError: noteError,
  } = useGuestbook(
    GUESTBOOK_PLACE_ID,
    worldSession?.userId ?? null,
    guestbookRevision,
    broadcastGuestbook,
  );

  // 방명록 패널이 열려 있는 동안에도 플레이어 조작을 잠근다
  const isGuestbookOpen = useGuestbookStore((state) => state.isOpen);
  const inputLocked = isChatFocused || isGuestbookOpen;

  // 로딩과 지연 처리가 모두 끝난 후에만 닉네임 입력창이 보이도록 함
  const showNicknameOverlay =
    isAssetsReady && isWorldReady && worldSession === null;

  return (
    <main className="w-full h-full relative overflow-hidden bg-[#fdfaf6]">
      <LoadingScreen visible={!isAssetsReady} />

      <AnimatePresence>
        {showNicknameOverlay && (
          <NicknameOverlay
            initialNickname={savedNickname}
            isSubmitting={isEntering}
            error={entryError}
            onJoin={async (name) => {
              // 사용자 제스처 컨텍스트 안에서 오디오 시작 (자동재생 정책)
              audio.init();
              audio.setNight(isNight);
              await enterWorld(name);
            }}
          />
        )}
      </AnimatePresence>

      {worldSession !== null && (
        <>
          <ChatHUD
            onSendMessage={broadcastChat}
            onFocusChange={setIsChatFocused}
          />
          <InteractionPrompt />
          <EmoteBar />
          <ZoneBanner />
          <Minimap />
          <SoundToggle />
          <InventoryHUD />
          <GuestbookPanel
            userId={worldSession.userId}
            onSubmit={submitNote}
            onDelete={removeNote}
            isSubmitting={isWritingNote}
            writeError={noteError}
          />
          <WorldHUD
            onlineCount={
              connectionStatus === "connected"
                ? remotePlayerIds.length + 1
                : 0
            }
            connectionStatus={connectionStatus}
          />
          <VillageHeader isNight={isNight} />
        </>
      )}

      <Scene isNight={isNight}>
        <World
          isNight={isNight}
          nickname={worldSession?.nickname ?? null}
          inputLocked={inputLocked}
          playerRef={playerRef}
          remotePlayerIds={remotePlayerIds}
          getPlayerData={getPlayerData}
          broadcastMove={broadcastMove}
          myId={worldSession?.userId ?? ""}
        />
      </Scene>
    </main>
  );
};
