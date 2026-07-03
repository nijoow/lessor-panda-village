"use client";

import { motion } from "framer-motion";
import { useZoneStore } from "@/stores/zoneStore";

/**
 * 존 진입 시 상단에 존 이름을 잠깐 보여주는 배너.
 * enterCount를 key로 써서 존이 바뀔 때마다 리마운트되고,
 * 키프레임 애니메이션이 표시→유지→소멸을 자체 처리한다 (상태 없음).
 */
export const ZoneBanner = () => {
  const zoneName = useZoneStore((s) => s.currentZoneName);
  const enterCount = useZoneStore((s) => s.enterCount);

  // 최초 스폰(첫 판정)은 조용히 넘어가고, 이동으로 존이 바뀔 때만 표시
  if (enterCount <= 1 || !zoneName) return null;

  return (
    <div className="absolute inset-x-0 top-24 sm:top-28 z-40 flex justify-center pointer-events-none">
      <motion.div
        key={enterCount}
        initial={{ opacity: 0, y: -14, scale: 0.96 }}
        animate={{
          opacity: [0, 1, 1, 0],
          y: [-14, 0, 0, -8],
          scale: [0.96, 1, 1, 0.98],
        }}
        transition={{ duration: 2.6, times: [0, 0.12, 0.85, 1], ease: "easeOut" }}
        className="glass-card rounded-full px-6 py-2.5 border-white/25 shadow-xl"
      >
        <span className="text-white text-base sm:text-lg font-bold drop-shadow">
          🐾 {zoneName}
        </span>
      </motion.div>
    </div>
  );
};
