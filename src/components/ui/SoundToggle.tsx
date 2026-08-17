"use client";

import { useState } from "react";
import { audio } from "@/lib/audio";

/** 우상단 음소거 토글 */
export const SoundToggle = () => {
  const [muted, setMuted] = useState(() => audio.muted);

  return (
    <button
      type="button"
      onClick={() => setMuted(audio.toggleMute())}
      className="absolute top-4 right-4 z-40 glass-card rounded-full w-11 h-11 flex items-center justify-center border-white/25 shadow-lg text-lg cursor-pointer hover:bg-white/30 transition-colors"
      aria-label={muted ? "소리 켜기" : "소리 끄기"}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
};
