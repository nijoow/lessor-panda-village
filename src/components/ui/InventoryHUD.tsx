"use client";

import { motion } from "framer-motion";
import { useHarvestStore } from "@/stores/harvestStore";

export const InventoryHUD = () => {
  const bambooCount = useHarvestStore((state) => state.bambooCount);
  return (
    <div className="pointer-events-none absolute right-4 top-56 z-40 lg:top-18">
      <motion.p key={bambooCount} initial={{ scale: bambooCount > 0 ? 1.2 : 1 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 12, stiffness: 300 }} aria-label={`모은 대나무 ${bambooCount}개`} className="glass-card flex items-center gap-2 rounded-full border-white/25 px-4 py-2 text-sm text-white shadow-lg">
        <span aria-hidden="true">🎋</span><span className="font-bold tabular-nums drop-shadow">{bambooCount}</span>
      </motion.p>
    </div>
  );
};
