"use client";

import { motion } from "framer-motion";
import { useHarvestStore } from "@/stores/harvestStore";

/** 우상단(사운드 토글 아래) 죽순 인벤토리 카운터 */
export const InventoryHUD = () => {
  const bambooCount = useHarvestStore((s) => s.bambooCount);

  return (
    <div className="absolute top-[4.5rem] right-4 z-40 pointer-events-none">
      <motion.div
        key={bambooCount}
        initial={{ scale: bambooCount > 0 ? 1.25 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 12, stiffness: 300 }}
        className="glass-card rounded-full px-4 py-2 border-white/25 shadow-lg flex items-center gap-2"
      >
        <span className="text-lg leading-none">🎋</span>
        <span className="text-white text-sm font-bold drop-shadow tabular-nums">
          {bambooCount}
        </span>
      </motion.div>
    </div>
  );
};
