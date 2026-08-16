"use client";

import { MultiplayerConnectionStatus } from "@/types/multiplayer";

interface WorldHUDProps {
  onlineCount: number;
  connectionStatus: MultiplayerConnectionStatus;
}

const STATUS_LABELS: Record<MultiplayerConnectionStatus, string> = {
  idle: "대기 중",
  connecting: "연결 중",
  connected: "연결됨",
  error: "연결 재시도 필요",
};

export const WorldHUD = ({
  onlineCount,
  connectionStatus,
}: WorldHUDProps) => {
  const isConnected = connectionStatus === "connected";

  return (
    <div className="absolute top-[7.75rem] right-4 z-40">
      <div className="glass-card rounded-2xl border-white/25 px-4 py-3 shadow-lg">
        <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
          영속 공유 월드
        </span>
        <span className="mt-1 flex items-center gap-2 text-xs font-bold text-white drop-shadow">
          <span
            className={`h-2 w-2 rounded-full ${
              isConnected ? "bg-emerald-300" : "bg-amber-300 animate-pulse"
            }`}
          />
          <span aria-live="polite">
            {onlineCount}명 접속 · {STATUS_LABELS[connectionStatus]}
          </span>
        </span>
      </div>
    </div>
  );
};
