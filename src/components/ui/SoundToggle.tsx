"use client";

import { useState } from "react";
import { audio } from "@/lib/audio";

export const SoundToggle = () => {
  const [muted, setMuted] = useState(() => audio.muted);
  return (
    <button
      type="button"
      onClick={() => setMuted(audio.toggleMute())}
      aria-pressed={!muted}
      className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-white/20 bg-white/10 px-3 text-sm text-white transition-colors hover:bg-white/20"
    >
      <span>마을 소리</span>
      <span className={muted ? "text-white/70" : "text-orange-200"}>
        {muted ? "꺼짐" : "켜짐"}
      </span>
    </button>
  );
};
