"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

interface Props {
  onJoin: (nickname: string) => Promise<void>;
  initialNickname?: string;
  isSubmitting?: boolean;
  error?: string | null;
}

const NICKNAMES = ["산책하는판다", "대나무친구", "느긋한판다", "졸린밤톨", "작은발자국"];

export const NicknameOverlay = ({ onJoin, initialNickname = "", isSubmitting = false, error }: Props) => {
  const [nickname, setNickname] = useState(initialNickname || NICKNAMES[0]);
  const suggestNickname = () => {
    const index = NICKNAMES.indexOf(nickname);
    setNickname(NICKNAMES[(index + 1) % NICKNAMES.length]);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-100 flex items-center justify-center overflow-y-auto bg-[#fdfaf6]/40 p-4 backdrop-blur-xl">
      <div className="glass-premium relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-[2.5rem] p-6 text-center sm:rounded-[3.5rem] sm:p-10">
        <Image src="/images/red_panda_icon.png" alt="레서판다" width={96} height={96} priority className="mx-auto mb-5 rounded-full border-4 border-white bg-linear-to-br from-orange-50 to-orange-100/50 shadow-xl sm:h-28 sm:w-28" />
        <h1 className="text-3xl font-black tracking-tight text-sky-950 sm:text-4xl">래서판다 빌리지</h1>
        <p className="mt-3 text-sm leading-6 text-sky-900 sm:text-base">잠깐 쉬어 가는 작은 마을.<br />걸어 다니고, 대나무를 모으고, 방명록을 남겨봐.</p>
        <form onKeyDown={(event) => {
          if (event.key === "Enter" && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault();
        }} onSubmit={async (event) => {
          event.preventDefault();
          if (!isSubmitting && nickname.trim().length > 0 && nickname.trim().length <= 10) await onJoin(nickname.trim());
        }} className="mt-6 text-left">
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="village-nickname" className="text-sm text-sky-950">마을에서 쓸 이름</label>
            <button type="button" disabled={isSubmitting} onClick={suggestNickname} className="min-h-11 rounded-xl px-2 text-sm text-orange-800 underline underline-offset-4 hover:bg-white/30 disabled:opacity-40">다른 이름 추천</button>
          </div>
          <input id="village-nickname" type="text" autoComplete="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={10} disabled={isSubmitting} aria-describedby={error ? "village-entry-error" : "nickname-hint"} className="glass-input w-full rounded-2xl px-5 py-4 text-lg text-sky-950 shadow-inner disabled:opacity-60 sm:rounded-3xl sm:text-xl" />
          <p id="nickname-hint" className="mt-3 text-xs text-sky-900">이름은 10자까지 쓸 수 있어. 가입은 필요 없어.</p>
          {error && <p id="village-entry-error" role="alert" className="mt-4 rounded-2xl border border-red-100/60 bg-red-50/85 p-3 text-sm leading-6 text-red-700">{error}</p>}
          <button type="submit" disabled={!nickname.trim() || isSubmitting} className="mt-6 min-h-14 w-full rounded-2xl bg-linear-to-br from-orange-400 to-orange-500 px-4 py-4 text-lg font-bold text-white shadow-lg shadow-orange-500/25 transition-colors hover:from-orange-300 hover:to-orange-400 disabled:cursor-not-allowed disabled:opacity-40 sm:rounded-3xl">{isSubmitting ? "마을에 들어가는 중…" : "마을 산책하기"}</button>
        </form>
        <p className="mt-5 text-xs text-sky-900">1~2분이면 둘러볼 수 있어</p>
      </div>
    </motion.div>
  );
};
