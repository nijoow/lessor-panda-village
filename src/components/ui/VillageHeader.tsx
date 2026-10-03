"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { worldFrameState } from "@/runtime/worldFrameState";

const STATUS_VISIBLE_MS = 5000;

/** 중앙 타이틀, 기본 조작 안내와 낮/밤 배너. */
export const VillageHeader = ({ isNight }: { isNight: boolean }) => {
  const [hasMoved, setHasMoved] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const position = worldFrameState.player;
    const startX = position.x;
    const startZ = position.z;
    const timer = window.setInterval(() => {
      if (Math.hypot(position.x - startX, position.z - startZ) > 0.8) {
        setHasMoved(true);
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const showTimer = window.setTimeout(() => setShowStatus(true), 0);
    const hideTimer = window.setTimeout(
      () => setShowStatus(false),
      STATUS_VISIBLE_MS,
    );
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [isNight]);

  return (
    <header
      className="pointer-events-none absolute left-1/2 top-4 z-40 flex w-full -translate-x-1/2 select-none flex-col items-center gap-2 px-4 text-center lg:top-10 lg:gap-4"
      style={{ fontFamily: "var(--font-jua), sans-serif" }}
    >
      <div className="relative flex max-w-full flex-col items-center gap-2 rounded-full border border-white/60 bg-white/40 px-4 py-2.5 drop-shadow-sm backdrop-blur-xl lg:px-12">
        <motion.h1
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center gap-1.5 whitespace-nowrap text-2xl font-black text-sky-950 drop-shadow-sm lg:gap-3 lg:text-4xl"
        >
          래서판다 빌리지
          <span className="relative size-6 overflow-hidden rounded-full shadow-sm lg:size-10">
            <Image
              src="/images/red_panda_icon.png"
              alt="Red Panda"
              fill
              priority
              sizes="(min-width: 1024px) 40px, 24px"
            />
          </span>
        </motion.h1>
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-center gap-1 lg:gap-2"
        >
          <p className="hidden text-sm font-bold tracking-widest text-sky-900/60 lg:block">
            화살표/WASD: 이동 | SHIFT: 달리기 | SPACE: 점프 | E: 상호작용
          </p>
          <p className="text-sm font-bold tracking-widest text-sky-900/60 lg:hidden">
            터치 또는 클릭으로 이동할 수 있어요!
          </p>
        </motion.div>
      </div>

      {!hasMoved && !showStatus ? (
        <p className="glass-card rounded-full px-4 py-2 text-xs font-bold text-sky-950">
          <span className="hidden sm:inline">바닥을 우클릭해서 걸어가 봐</span>
          <span className="sm:hidden">가고 싶은 바닥을 눌러봐</span>
        </p>
      ) : null}

      <AnimatePresence>
        {showStatus && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`rounded-full px-6 py-2 text-sm font-bold shadow-xl transition-all duration-1000 ${
              isNight
                ? "bg-indigo-950/80 text-yellow-300 ring-2 ring-yellow-400/30"
                : "bg-amber-100/80 text-orange-800 ring-2 ring-orange-500/30"
            }`}
          >
            {isNight ? "🌙 고요한 밤이에요" : "☀️ 화창한 낮이에요"}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
