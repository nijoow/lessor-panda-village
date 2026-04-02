"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

interface Props {
  onJoin: (nickname: string) => void;
}

export const NicknameOverlay = ({ onJoin }: Props) => {
  const [nickname, setNickname] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim().length > 0 && nickname.trim().length <= 10) {
      setIsSubmitting(true);
      setTimeout(() => {
        onJoin(nickname.trim());
      }, 500);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-100 flex items-center justify-center bg-[#fdfaf6]/40 backdrop-blur-xl overflow-hidden"
    >
      {/* Decorative Floating Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-[10%] w-32 h-32 bg-orange-200/30 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-[15%] w-48 h-48 bg-sky-200/30 rounded-full blur-3xl animate-float-delayed" />
        <div className="absolute top-1/2 left-[80%] w-24 h-24 bg-yellow-200/20 rounded-full blur-2xl animate-float-slow" />
      </div>

      <motion.div
        initial={{ scale: 0.95, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 30, stiffness: 120 }}
        className="w-full max-w-lg p-8 sm:p-12 glass-premium rounded-[2.5rem] sm:rounded-[3.5rem] flex flex-col items-center relative"
      >
        {/* Glow behind icon */}
        <div className="absolute top-[-40px] w-48 h-48 bg-orange-400/20 rounded-full blur-[60px] pointer-events-none" />

        <div className="mb-10 relative">
          <motion.div
            whileHover={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ duration: 0.5 }}
            className="w-24 h-24 sm:w-32 sm:h-32 bg-linear-to-br from-orange-50 to-orange-100/50 rounded-full flex items-center justify-center shadow-xl overflow-hidden border-4 border-white"
          >
            <Image
              src="/images/red_panda_icon.png"
              alt="Red Panda"
              width={128}
              height={128}
              className="object-contain"
            />
          </motion.div>
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -top-1 -right-3 bg-yellow-400 text-[11px] font-black px-3 py-1.5 rounded-full text-orange-950 shadow-lg border-2 border-white uppercase tracking-tighter"
          >
            Hello!
          </motion.div>
        </div>

        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-4xl font-black text-sky-950 mb-3 tracking-tight">
            레서판다 마을 입장
          </h2>
          <p className="text-sky-800/60 font-bold text-base sm:text-lg">
            마을에서 사용할 닉네임을 입력해주세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-8">
          <div className="relative group">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임을 입력해주세요"
              maxLength={10}
              autoFocus
              className="w-full px-6 sm:px-10 py-4 sm:py-6 glass-input rounded-2xl sm:rounded-3xl text-lg sm:text-2xl font-bold text-sky-900 placeholder:text-sky-900/20 shadow-inner group-hover:bg-white/60"
            />
            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-sky-900/30 text-sm font-black bg-white/40 px-3 py-1 rounded-full">
              {nickname.length}/10
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={nickname.trim().length === 0}
            className={`
              relative w-full py-4 sm:py-6 rounded-2xl sm:rounded-3xl text-lg sm:text-2xl font-black shadow-2xl transition-all duration-300 overflow-hidden
              ${
                nickname.trim().length > 0
                  ? "bg-linear-to-br from-orange-400 to-orange-500 text-white shadow-orange-200 cursor-pointer"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }
            `}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-3">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-7 h-7 border-4 border-white/30 border-t-white rounded-full"
                />
                입장하는 중...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                마을로 향하기
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </span>
            )}
          </motion.button>
        </form>

        <div className="mt-12 flex flex-col items-center gap-4">
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-sky-900/10" />
            ))}
          </div>
          <p className="text-sky-900/30 text-xs font-black uppercase tracking-[0.3em] text-center">
            Lessor&nbsp;Panda&nbsp;Village • &copy;nijoow
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};
