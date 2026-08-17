"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getNicknameColor } from "@/utils/color";
import { MAX_NOTE_LENGTH } from "@/hooks/useGuestbook";
import { NOTE_COST, useGuestbookStore } from "@/stores/guestbookStore";
import { useHarvestStore } from "@/stores/harvestStore";

interface Props {
  userId: string;
  onSubmit: (body: string) => Promise<boolean>;
  onDelete: (noteId: string) => void;
  isSubmitting: boolean;
  writeError: string | null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const formatWhen = (timestamp: number): string => {
  const elapsed = Date.now() - timestamp;
  if (elapsed < MINUTE) return "방금";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}분 전`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}시간 전`;
  return `${Math.floor(elapsed / DAY)}일 전`;
};

/**
 * 방명록 패널. 게시판 근처에서 E를 누르면 열립니다.
 * 열려 있는 동안 플레이어 입력은 잠깁니다(page.tsx의 inputLocked).
 */
export const GuestbookPanel = ({
  userId,
  onSubmit,
  onDelete,
  isSubmitting,
  writeError,
}: Props) => {
  const isOpen = useGuestbookStore((state) => state.isOpen);
  const close = useGuestbookStore((state) => state.close);
  const notes = useGuestbookStore((state) => state.notes);
  const status = useGuestbookStore((state) => state.status);
  const bambooCount = useHarvestStore((state) => state.bambooCount);

  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  const trimmed = draft.trim();
  const canAfford = bambooCount >= NOTE_COST;
  const canSubmit =
    trimmed.length > 0 &&
    trimmed.length <= MAX_NOTE_LENGTH &&
    canAfford &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const ok = await onSubmit(trimmed);
    if (ok) setDraft("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", damping: 22, stiffness: 220 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg glass-premium rounded-3xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            {/* 머리말 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/30">
              <div className="flex items-baseline gap-2">
                <h2 className="text-white text-lg font-black drop-shadow">
                  마을 방명록
                </h2>
                <span className="text-white/60 text-xs font-bold tabular-nums">
                  {notes.length}장
                </span>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="방명록 닫기"
                className="w-8 h-8 rounded-full bg-white/30 hover:bg-white/50 text-white font-black transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 쪽지 목록 */}
            <div
              className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3 min-h-[8rem]"
              style={{ scrollbarWidth: "none" }}
            >
              {status === "loading" && notes.length === 0 && (
                <p className="text-white/60 text-sm font-bold text-center py-8">
                  쪽지를 불러오는 중...
                </p>
              )}

              {status === "error" && notes.length === 0 && (
                <p className="text-white/70 text-sm font-bold text-center py-8">
                  쪽지를 불러오지 못했어요. 잠시 후 다시 열어주세요.
                </p>
              )}

              {status === "ready" && notes.length === 0 && (
                <p className="text-white/60 text-sm font-bold text-center py-8 leading-relaxed">
                  아직 아무도 쪽지를 걸지 않았어요.
                  <br />
                  이 마을의 첫 흔적을 남겨보세요.
                </p>
              )}

              {notes.map((note) => (
                <div
                  key={note.id}
                  className="group glass-card rounded-2xl px-4 py-3 border-white/20"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-none shadow"
                      style={{
                        backgroundColor: getNicknameColor(note.authorId),
                      }}
                    />
                    <span className="text-white text-xs font-black tracking-wide drop-shadow">
                      {note.nickname}
                    </span>
                    <span className="text-white/40 text-[10px] font-bold">
                      {formatWhen(note.createdAt)}
                    </span>
                    {note.authorId === userId && (
                      <button
                        type="button"
                        onClick={() => onDelete(note.id)}
                        className="ml-auto text-white/40 hover:text-white/90 text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        지우기
                      </button>
                    )}
                  </div>
                  <p className="text-white text-sm font-bold leading-relaxed break-words">
                    {note.body}
                  </p>
                </div>
              ))}
            </div>

            {/* 작성 */}
            <div className="px-6 py-4 border-t border-white/30 flex flex-col gap-2">
              <textarea
                value={draft}
                onChange={(e) =>
                  setDraft(e.target.value.slice(0, MAX_NOTE_LENGTH))
                }
                placeholder="이 마을에 남기고 싶은 말을 적어주세요"
                rows={2}
                maxLength={MAX_NOTE_LENGTH}
                className="glass-input rounded-2xl px-4 py-3 text-white text-sm font-bold placeholder:text-white/30 outline-none resize-none"
              />

              {writeError && (
                <p className="text-orange-200 text-xs font-bold px-1">
                  {writeError}
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="text-white/50 tabular-nums">
                    {trimmed.length}/{MAX_NOTE_LENGTH}
                  </span>
                  <span
                    className={canAfford ? "text-white/70" : "text-orange-200"}
                  >
                    🎋 {NOTE_COST}개 필요 (보유 {bambooCount})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="px-5 py-2.5 rounded-full bg-orange-400 text-white text-sm font-black shadow-lg shadow-orange-500/30 hover:bg-orange-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex-none"
                >
                  {isSubmitting ? "거는 중..." : "쪽지 걸기"}
                </button>
              </div>

              {!canAfford && (
                <p className="text-white/50 text-[11px] font-bold px-1">
                  대나무 숲에서 죽순을 모아오면 쪽지를 더 걸 수 있어요.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
