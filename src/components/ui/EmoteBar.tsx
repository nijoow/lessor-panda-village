"use client";

import { motion } from "framer-motion";
import { EMOTES } from "@/constants/playerAnimations";
import { useInteractionStore } from "@/stores/interactionStore";

export const EmoteBar = () => {
  const requestEmote = useInteractionStore((state) => state.requestEmote);
  return (
    <div className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex gap-2 sm:bottom-8 sm:right-8">
      {EMOTES.map((emote, index) => (
        <motion.button key={emote.anim} type="button" whileTap={{ scale: 0.9 }} onClick={() => requestEmote(emote.anim)} className="glass-card pointer-events-auto flex h-14 w-14 flex-col items-center justify-center rounded-2xl border-white/20 text-white shadow-xl transition-colors select-none hover:bg-white/30 sm:h-16 sm:w-16" aria-label={`${emote.label} 이모트`}>
          <span className="text-xl leading-none sm:text-2xl" aria-hidden="true">{emote.icon}</span>
          <span className="mt-1 text-[10px] font-bold drop-shadow"><span className="hidden sm:inline">{index + 1} </span>{emote.label}</span>
        </motion.button>
      ))}
    </div>
  );
};
