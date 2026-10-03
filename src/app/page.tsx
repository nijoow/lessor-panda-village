"use client";

import {
  KeyboardControls,
  KeyboardControlsEntry,
} from "@react-three/drei";
import { AnimatePresence } from "framer-motion";
import { useCallback, useState, useEffect } from "react";
import dynamic from "next/dynamic";

import { Controls } from "@/domain/player";
import { VillageHeader } from "@/components/ui/VillageHeader";
import { useVillageSession } from "@/hooks/useVillageSession";
import { useGuestbook } from "@/hooks/useGuestbook";
import { useDayNightCycle } from "@/hooks/useDayNightCycle";
import { useViewportHeight } from "@/hooks/useViewportHeight";
import { useGuestbookStore } from "@/stores/guestbookStore";
import { NOTICE_BOARDS } from "@/constants/world";
import { audio } from "@/lib/audio";
import { WorldErrorBoundary, WorldFallback } from "@/components/ui/WorldFallback";
import { GraphicsSettings } from "@/components/ui/GraphicsSettings";

// 3D 장면과 HUD는 클라이언트에서 불러온다.
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

// 현재 흔적 장소는 마을 게시판 하나뿐이다.
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


export default function Home() {
  const isNight = useDayNightCycle();

  useViewportHeight();

  return (
    <KeyboardControls map={keyboardMap}>
      <HomeContent isNight={isNight} />
    </KeyboardControls>
  );
}

interface HomeContentProps {
  isNight: boolean;
}

const HomeContent = ({ isNight }: HomeContentProps) => {
  const [isChatFocused, setIsChatFocused] = useState(false);
  const [isAssetsReady, setIsAssetsReady] = useState(false);
  const [sceneUnavailable, setSceneUnavailable] = useState(false);
  const {
    worldSession,
    savedNickname,
    isReady: isWorldReady,
    isEntering,
    entryError,
    enterWorld,
    reconnectWorld,
    capabilities,
    remotePlayerIds, connectionStatus, guestbookRevision, getPlayerData,
    broadcastMove, broadcastChat, broadcastGuestbook,
  } = useVillageSession();

  const { authenticated, canWriteNotes, canChat } = capabilities;
  const handleWorldReady = useCallback(() => setIsAssetsReady(true), []);

  // 낮밤 전환 시 앰비언스(새소리↔풀벌레) 크로스페이드
  useEffect(() => {
    audio.setNight(isNight);
  }, [isNight]);
  useEffect(() => () => audio.dispose(), []);

  const {
    submit: submitNote,
    remove: removeNote,
    isSubmitting: isWritingNote,
    writeError: noteError,
    refresh, loadOlder, hasMore, isLoadingMore, mineOnly, setMineOnly,
    visibleNotes, deleteError,
  } = useGuestbook(
    GUESTBOOK_PLACE_ID,
    authenticated ? worldSession?.userId ?? null : null,
    guestbookRevision,
    broadcastGuestbook,
    { readOnly: !canWriteNotes },
  );

  // 방명록 패널이 열려 있는 동안에도 플레이어 조작을 잠근다
  const isGuestbookOpen = useGuestbookStore((state) => state.isOpen);
  const inputLocked = !isAssetsReady || isChatFocused || isGuestbookOpen || sceneUnavailable;

  // 에셋 로딩 중에도 닉네임을 정할 수 있다.
  const showNicknameOverlay =
    isWorldReady && worldSession === null;

  return (
    <main className="w-full h-full relative overflow-hidden bg-[#fdfaf6]">
      {worldSession !== null && !sceneUnavailable && <LoadingScreen ready={isAssetsReady} />}

      <AnimatePresence>
        {showNicknameOverlay && (
          <NicknameOverlay
            initialNickname={savedNickname}
            isSubmitting={isEntering}
            error={entryError}
            onJoin={async (name) => {
              // 사용자 제스처 컨텍스트 안에서 오디오 시작 (자동재생 정책)
              try { audio.init(); audio.setNight(isNight); } catch { /* 소리 실패와 입장은 별개다. */ }
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
            readOnly={!canChat}
          />
          <InteractionPrompt />
          <EmoteBar />
          <ZoneBanner />
          <Minimap />
          <InventoryHUD />
          <GuestbookPanel
            userId={authenticated ? worldSession.userId : null}
            readOnly={!canWriteNotes}
            onRefresh={refresh}
            onLoadOlder={loadOlder}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            mineOnly={mineOnly}
            onMineOnlyChange={setMineOnly}
            visibleNotes={visibleNotes}
            deleteError={deleteError}
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
            offline={!authenticated}
            isReconnecting={isEntering || connectionStatus === "connecting"}
            onReconnect={reconnectWorld}
          ><GraphicsSettings /></WorldHUD>
          <VillageHeader isNight={isNight} />
        </>
      )}

      {sceneUnavailable && <WorldFallback onRetry={() => window.location.reload()} />}
      <WorldErrorBoundary>
      <Scene isNight={isNight} onUnavailable={() => setSceneUnavailable(true)}>
        <World
          onReady={handleWorldReady}
          isNight={isNight}
          nickname={worldSession?.nickname ?? null}
          inputLocked={inputLocked}
          remotePlayerIds={remotePlayerIds}
          getPlayerData={getPlayerData}
          broadcastMove={broadcastMove}
          myId={worldSession?.userId ?? ""}
        />
      </Scene>
      </WorldErrorBoundary>
    </main>
  );
};
