"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useInteractionStore } from "@/stores/interactionStore";

/**
 * 상호작용 가능 오브젝트(벤치) 근처에서 표시되는 안내 프롬프트.
 * 데스크톱은 E 키 안내, 모바일은 버튼 탭으로 동작합니다 (둘 다 클릭 가능).
 */
export const InteractionPrompt = () => {
  const nearbyBenchIndex = useInteractionStore((s) => s.nearbyBenchIndex);
  const isSitting = useInteractionStore((s) => s.isSitting);
  const requestToggleSit = useInteractionStore((s) => s.requestToggleSit);

  const visible = isSitting || nearbyBenchIndex !== null;
  const label = isSitting ? "일어서기" : "벤치에 앉기";

  return (
    <div className="absolute inset-x-0 bottom-28 sm:bottom-36 z-40 flex justify-center pointer-events-none">
      <AnimatePresence>
        {visible && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: "spring", damping: 20, stiffness: 200 }}
            onClick={requestToggleSit}
            className="pointer-events-auto flex items-center gap-3 px-5 py-3 glass-card rounded-full border-white/20 shadow-xl cursor-pointer hover:bg-white/30 transition-colors"
          >
            <span className="hidden sm:flex items-center justify-center w-7 h-7 rounded-lg bg-white/90 text-gray-800 text-sm font-black shadow">
              E
            </span>
            <span className="text-white text-sm font-bold drop-shadow">
              {label}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
