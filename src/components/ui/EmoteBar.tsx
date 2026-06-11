"use client";

import { motion } from "framer-motion";
import { EMOTES } from "@/constants/playerAnimations";
import { useInteractionStore } from "@/stores/interactionStore";

/**
 * 이모트 실행 버튼 바 (우하단).
 * 데스크톱은 숫자키(1/2)로도 실행 가능하며, 같은 이모트를 다시 누르면 해제됩니다.
 */
export const EmoteBar = () => {
  const requestEmote = useInteractionStore((s) => s.requestEmote);

  return (
    <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 z-40 flex gap-2 pointer-events-none">
      {EMOTES.map((emote, i) => (
        <motion.button
          key={emote.anim}
          type="button"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * i }}
          whileTap={{ scale: 0.9 }}
          onClick={() => requestEmote(emote.anim)}
          className="pointer-events-auto flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 glass-card rounded-2xl border-white/20 shadow-xl cursor-pointer hover:bg-white/30 transition-colors select-none"
          aria-label={`${emote.label} 이모트`}
        >
          <span className="text-xl sm:text-2xl leading-none">{emote.icon}</span>
          <span className="text-white text-[10px] font-bold mt-1 drop-shadow">
            <span className="hidden sm:inline">{i + 1} </span>
            {emote.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
};
