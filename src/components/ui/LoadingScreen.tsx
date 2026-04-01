"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useProgress } from "@react-three/drei";
import Image from "next/image";

interface Props {
  visible: boolean;
}

export const LoadingScreen = ({ visible }: Props) => {
  const { progress } = useProgress();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1, ease: "anticipate" } }}
          className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-[#fdfaf6]"
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

          <div className="relative flex flex-col items-center max-w-md w-full px-12">
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
              className="relative w-40 h-40 mb-12"
            >
              <div className="absolute inset-0 bg-orange-400/30 rounded-full blur-3xl animate-pulse" />
              <div className="relative z-10 w-full h-full bg-linear-to-br from-white to-orange-50 rounded-full p-4 shadow-2xl border-4 border-white overflow-hidden">
                <Image
                  src="/images/red_panda_icon.png"
                  alt="Loading Red Panda"
                  fill
                  className="object-contain p-4 transition-transform duration-500 hover:scale-110"
                />
              </div>
            </motion.div>

            {/* Loading Info */}
            <div className="w-full text-center space-y-8">
              <div className="space-y-2">
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-black text-sky-950 tracking-tight"
                >
                  마을로 여행을 떠나요
                </motion.h2>
                <p className="text-sky-800/40 font-bold text-sm uppercase tracking-[0.2em]">
                  Lessor Panda Village
                </p>
              </div>

              {/* Sophisticated Progress Bar */}
              <div className="relative w-full ">
                <div className="relative w-full h-4 bg-sky-100 rounded-full overflow-hidden border-2 border-white shadow-inner">
                  <motion.div
                    className="absolute left-0 top-0 h-full bg-linear-to-r from-orange-400 via-yellow-400 to-orange-500 shadow-[0_0_15px_rgba(251,146,60,0.5)]"
                    initial={{ width: "0%" }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>

                {/* Progress Percentage Display */}
                <motion.div className="absolute -top-8 right-0 text-orange-600 font-black text-sm">
                  {Math.round(progress)}%
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
            className="absolute bottom-16 glass-card px-8 py-4 rounded-3xl"
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
