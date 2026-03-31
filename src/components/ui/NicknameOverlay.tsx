"use client";

import { useState } from "react";
import { motion } from "framer-motion";

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
      // 부드러운 전환을 위해 약간의 딜레이
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
      className="absolute inset-0 z-100 flex items-center justify-center bg-[#fdfaf6]/80 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-full max-w-md p-10 bg-white/40 rounded-[3rem] shadow-2xl border border-white/60 backdrop-blur-2xl flex flex-col items-center"
      >
        <div className="mb-8 relative">
          <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center shadow-lg overflow-hidden border-2 border-orange-200">
            <img
              src="/images/red_panda_icon.png"
              alt="Red Panda"
              className="w-24 h-24 object-contain"
            />
          </div>
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
            className="absolute -top-2 -right-2 bg-yellow-400 text-[10px] font-black px-2 py-1 rounded-full text-orange-950 shadow-sm"
          >
            WELCOME!
          </motion.div>
        </div>

        <h2 className="text-3xl font-black text-sky-950 mb-2">
          레서판다 마을 입장
        </h2>
        <p className="text-sky-800/70 font-medium mb-10 text-center">
          마을에서 사용할 닉네임을 입력해주세요.
          <br />
          (최대 10자)
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
          <div className="relative group">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임을 입력하세요..."
              maxLength={10}
              autoFocus
              className="w-full px-8 py-5 bg-white/60 rounded-2xl border-2 border-transparent focus:border-orange-300 outline-none transition-all duration-300 text-xl font-bold text-sky-900 placeholder:text-sky-900/30 shadow-sm group-hover:bg-white/80"
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-sky-900/40 text-sm font-bold">
              {nickname.length}/10
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={nickname.trim().length === 0 || isSubmitting}
            className={`
              w-full py-5 rounded-2xl text-xl font-black shadow-xl transition-all duration-300
              ${
                nickname.trim().length > 0
                  ? "bg-linear-to-br from-orange-400 to-orange-500 text-white shadow-orange-200 cursor-pointer"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }
            `}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full"
                />
                입장 중...
              </span>
            ) : (
              "마을로 향하기"
            )}
          </motion.button>
        </form>

        <p className="mt-8 text-sky-900/40 text-xs font-bold uppercase tracking-widest">
          Lessor Panda Village • 2026
        </p>
      </motion.div>
    </motion.div>
  );
};
