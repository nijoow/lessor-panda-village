"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useProgress } from "@react-three/drei";
import Image from "next/image";

export const LoadingScreen = () => {
  const { progress } = useProgress();

  return (
    <AnimatePresence>
      {progress < 100 && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-[#fdfaf6]"
        >
      {/* 배경 장식 (부드러운 그라데이션 원) */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-100/50 rounded-full blur-[80px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sky-100/50 rounded-full blur-[80px]" />

      <div className="relative flex flex-col items-center">
        {/* 레서판다 아이콘 바운싱 애니메이션 */}
        <motion.div
          animate={{
            y: [0, -25, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative w-32 h-32 rounded-full mb-8 drop-shadow-2xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-orange-400/20 rounded-full blur-2xl animate-pulse" />
          <Image
            src="/images/red_panda_icon.png"
            alt="Loading Red Panda"
            fill
            className="object-contain relative z-10"
          />
        </motion.div>

        {/* 로딩 텍스트 및 퍼센트 */}
        <div className="text-center space-y-4">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-black text-orange-900"
          >
            레서판다 마을을 불러오고 있어요...
          </motion.h2>

          <div className="relative w-full h-3 bg-orange-100 rounded-full overflow-hidden border border-orange-200">
            <motion.div
              className="absolute left-0 top-0 h-full bg-linear-to-r from-orange-400 to-orange-500"
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          <motion.p
            className="text-orange-800/60 font-bold text-sm"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {Math.round(progress)}% 완료
          </motion.p>
        </div>
      </div>

      {/* 하단 팁 (선택 사항) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-12 text-orange-950/40 text-xs font-medium tracking-widest uppercase"
      >
        Tip: Shift 키를 누르면 더 빨리 달릴 수 있어요!
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
