"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useProgress } from "@react-three/drei";
import Image from "next/image";
import { useEffect, useState } from "react";

export const LoadingScreen = ({ ready }: { ready: boolean }) => {
  const progress = useProgress((state) => state.progress);
  const [displayedProgress, setDisplayedProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  // LoadingManager는 새 파일 묶음이 시작될 때 비율을 다시 계산한다.
  // 한 번의 입장에서는 표시값을 유지하고, 실제 장면 준비 후에만 완료한다.
  const nextProgress = ready
    ? 100
    : Math.min(
        99,
        Math.max(0, Math.round(Number.isFinite(progress) ? progress : 0)),
      );
  if (nextProgress > displayedProgress) setDisplayedProgress(nextProgress);

  useEffect(() => {
    if (!ready) return;
    // 완료값을 한 번 그린 뒤 기존 페이드아웃으로 입장한다.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setDismissed(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [ready]);

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1, ease: "anticipate" } }}
          className="fixed inset-0 z-[110] flex flex-col items-center justify-center overflow-hidden bg-[#fdfaf6]"
          style={{ fontFamily: "var(--font-jua), sans-serif" }}
        >
          {/* Animated Background Gradients */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-orange-200/40 rounded-full blur-[120px]"
          />
          <motion.div
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-sky-200/40 rounded-full blur-[120px]"
          />

          <div className="relative flex flex-col items-center max-w-md w-full px-6 sm:px-12">
            {/* Red Panda Icon with Pulsing Effect */}
            <motion.div
              animate={{
                y: [0, -30, 0],
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative w-28 h-28 sm:w-40 sm:h-40 mb-12"
            >
              <div className="absolute inset-0 bg-orange-400/30 rounded-full blur-3xl animate-pulse" />
              <div className="relative z-10 w-full h-full bg-linear-to-br from-white to-orange-50 rounded-full p-4 shadow-2xl border-4 border-white overflow-hidden">
                <Image
                  src="/images/red_panda_icon.png"
                  alt=""
                  fill
                  sizes="(min-width: 640px) 160px, 112px"
                  className="object-contain transition-transform duration-500 hover:scale-110"
                />
              </div>
            </motion.div>

            {/* Loading Info */}
            <div className="w-full text-center space-y-8">
              <div className="space-y-2">
                <motion.h2
                  role="status"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl sm:text-3xl font-black text-sky-950 tracking-tight"
                >
                  마을로 여행을 떠나요
                </motion.h2>
                <p className="text-sky-800/40 font-bold text-sm uppercase tracking-[0.2em]">
                  Lessor Panda Village
                </p>
              </div>

              {/* Sophisticated Progress Bar */}
              <div className="relative w-full ">
                <div
                  role="progressbar"
                  aria-label="마을 불러오기"
                  aria-valuenow={displayedProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="relative w-full h-4 bg-sky-100 rounded-full overflow-hidden border-2 border-white shadow-inner"
                >
                  <motion.div
                    className="absolute left-0 top-0 h-full bg-linear-to-r from-orange-400 via-yellow-400 to-orange-500 shadow-[0_0_15px_rgba(251,146,60,0.5)]"
                    initial={{ width: "0%" }}
                    animate={{ width: `${displayedProgress}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>

                {/* Progress Percentage Display */}
                <motion.div className="absolute -top-8 right-0 text-orange-600 font-black text-sm">
                  {displayedProgress}%
                </motion.div>
              </div>

              <motion.p
                className="text-orange-900/40 font-bold text-xs italic"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                레서판다들이 당신을 기다리고 있어요...
              </motion.p>
            </div>
          </div>

          {/* Bottom Tip Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-10 sm:bottom-16 glass-card max-w-[calc(100%-2rem)] px-8 py-4 rounded-3xl"
          >
            <p className="text-sky-900/60 text-[10px] font-black tracking-widest uppercase flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
              Tip: Shift 키를 누르면 더 빨리 달릴 수 있어요!
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
