"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { MultiplayerConnectionStatus } from "@/types/multiplayer";
import { SoundToggle } from "@/components/ui/SoundToggle";

interface WorldHUDProps {
  onlineCount: number;
  connectionStatus: MultiplayerConnectionStatus;
  children?: ReactNode;
  offline?: boolean;
  isReconnecting?: boolean;
  onReconnect?: () => void;
}

const STATUS_LABELS: Record<MultiplayerConnectionStatus, string> = {
  idle: "대기 중",
  connecting: "연결 중",
  connected: "함께 산책 중",
  error: "연결을 확인하고 있어",
};

export const WorldHUD = ({ onlineCount, connectionStatus, children, offline = false, isReconnecting = false, onReconnect }: WorldHUDProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    return () => window.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="absolute right-4 top-41 z-50 lg:top-4" onKeyDown={(event) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    }}>
      <button ref={triggerRef} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="village-settings" className="flex min-h-11 items-center gap-2 rounded-full border border-white/30 bg-sky-950/45 px-4 text-sm text-white shadow-lg backdrop-blur-xl transition-colors hover:bg-sky-950/55">
        <span className={`h-1.5 w-1.5 rounded-full ${!offline && connectionStatus === "connected" ? "bg-emerald-300" : "bg-amber-300"}`} />
        설정
      </button>
      {open && <section id="village-settings" aria-label="마을 설정" className="absolute right-0 mt-2 max-h-[calc(100dvh-15rem)] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-3xl border border-white/35 bg-sky-950/75 p-4 text-sm text-white shadow-2xl backdrop-blur-2xl lg:max-h-[calc(100dvh-5rem)]">
        <p role="status" className="mb-3 text-xs text-white/85">{offline ? "혼자 둘러보는 중" : `${connectionStatus === "connected" ? `${onlineCount}명 · ` : ""}${STATUS_LABELS[connectionStatus]}`}</p>
        {(offline || connectionStatus === "error") && onReconnect && <button type="button" disabled={isReconnecting} onClick={onReconnect} className="mb-3 min-h-11 w-full rounded-2xl border border-orange-200/35 bg-orange-400/20 px-3 text-left text-sm text-orange-100 transition-colors hover:bg-orange-400/30 disabled:opacity-50">{isReconnecting ? "연결하는 중…" : "마을에 다시 연결"}</button>}
        <SoundToggle />
        {children && <div className="mt-3 border-t border-white/20 pt-3">{children}</div>}
      </section>}
    </div>
  );
};
