"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

const STATUS_VISIBLE_MS = 5000;

interface Props {
  isNight: boolean;
}

/** 상단 타이틀 + 조작 안내 + 낮/밤 상태 알림 배너 */
export const VillageHeader = ({ isNight }: Props) => {
  const [showStatus, setShowStatus] = useState(false);

  // 낮/밤 전환 시 상태창 표시 및 5초 후 페이드 아웃
  useEffect(() => {
    // 마이크로태스크나 다음 틱으로 미뤄서 동기적 setState 경고 해결
    const showTimer = setTimeout(() => setShowStatus(true), 0);
    const hideTimer = setTimeout(() => {
      setShowStatus(false);
    }, STATUS_VISIBLE_MS);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [isNight]);

  return (
    <div className="absolute top-4 sm:top-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 sm:gap-4 w-full px-4 text-center z-10 pointer-events-none select-none">
      <div className="flex flex-col items-center px-12 py-2.5 bg-white/40 rounded-full gap-2 backdrop-blur-xl drop-shadow-sm border-white/60 border">
        <motion.h1
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-2xl sm:text-4xl font-black text-sky-950 drop-shadow-sm flex items-center gap-1.5 sm:gap-3"
        >
          래서판다 빌리지
          <div className="relative size-6 sm:size-10 shadow-sm rounded-full overflow-hidden">
            <Image
              src="/images/red_panda_icon.png"
              alt="Red Panda"
              fill
              priority
              sizes="(max-width: 768px) 24px, 40px"
            />
          </div>
        </motion.h1>
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-center gap-1 sm:gap-2"
        >
          <p className="hidden sm:block text-sky-900/60 text-xs sm:text-sm font-bold tracking-widest">
            화살표/WASD: 이동 | SHIFT: 달리기 | SPACE: 점프
          </p>
          <p className="block sm:hidden text-sky-900/60 text-sm font-bold tracking-widest">
            터치 또는 클릭으로 이동할 수 있어요!
          </p>
        </motion.div>
      </div>
      <AnimatePresence>
        {showStatus && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`px-6 py-2 rounded-full text-sm font-bold shadow-xl transition-all duration-1000 ${
              isNight
                ? "bg-indigo-950/80 text-yellow-300 ring-2 ring-yellow-400/30"
                : "bg-amber-100/80 text-orange-800 ring-2 ring-orange-500/30"
            }`}
          >
            {isNight ? "🌙 고요한 밤이에요" : "☀️ 화창한 낮이에요"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
