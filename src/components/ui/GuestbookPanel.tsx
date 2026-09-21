"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getNicknameColor } from "@/utils/color";
import { MAX_NOTE_LENGTH } from "@/hooks/useGuestbook";
import { GuestbookNote, NOTE_COST, useGuestbookStore } from "@/stores/guestbookStore";
import { useHarvestStore } from "@/stores/harvestStore";

interface Props {
  userId: string | null;
  readOnly?: boolean;
  onRefresh?: () => void;
  onLoadOlder?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  mineOnly?: boolean;
  onMineOnlyChange?: (value: boolean) => void;
  visibleNotes?: GuestbookNote[];
  deleteError?: string | null;
  onSubmit: (body: string) => Promise<boolean>;
  onDelete: (noteId: string) => void;
  isSubmitting: boolean;
  writeError: string | null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
const focusStyle = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-200";

const formatWhen = (timestamp: number): string => {
  const elapsed = Date.now() - timestamp;
  if (elapsed < MINUTE) return "방금";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}분 전`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}시간 전`;
  return `${Math.floor(elapsed / DAY)}일 전`;
};

export const GuestbookPanel = ({
  userId,
  onSubmit,
  onDelete,
  isSubmitting,
  writeError,
  readOnly = false,
  onRefresh,
  onLoadOlder,
  hasMore = false,
  isLoadingMore = false,
  mineOnly = false,
  onMineOnlyChange,
  visibleNotes,
  deleteError,
}: Props) => {
  const isOpen = useGuestbookStore((state) => state.isOpen);
  const close = useGuestbookStore((state) => state.close);
  const storedNotes = useGuestbookStore((state) => state.notes);
  const cachedAt = useGuestbookStore((state) => state.cachedAt);
  const notes = visibleNotes ?? storedNotes;
  const canWrite = !readOnly && Boolean(userId);
  const status = useGuestbookStore((state) => state.status);
  const bambooCount = useHarvestStore((state) => state.bambooCount);
  const [draft, setDraft] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const countId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => element.getClientRects().length > 0);
    const focusFirst = () => (focusables()[0] ?? dialog).focus({ preventScroll: true });
    const frame = requestAnimationFrame(focusFirst);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === "Tab") {
        const items = focusables();
        const first = items[0];
        const last = items.at(-1);
        const active = document.activeElement;
        if (!first || !last) { event.preventDefault(); dialog.focus(); return; }
        if (event.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
          event.preventDefault(); first.focus();
        }
      }
    };
    const keepFocusInside = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) focusFirst();
    };
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", keepFocusInside);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", keepFocusInside);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [isOpen, close]);

  const trimmed = draft.trim();
  const canAfford = bambooCount >= NOTE_COST;
  const canSubmit = canWrite && trimmed.length > 0 && trimmed.length <= MAX_NOTE_LENGTH && canAfford && !isSubmitting;
  const handleSubmit = async () => {
    if (!canSubmit) return;
    const submittedDraft = draft;
    const ok = await onSubmit(trimmed);
    if (ok) setDraft((current) => current === submittedDraft ? "" : current);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm sm:p-4"
          onClick={close}
        >
          <motion.div
            ref={dialogRef}
            role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16 }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-y-auto overscroll-contain rounded-3xl border border-white/35 bg-sky-950/75 text-white shadow-2xl outline-none backdrop-blur-2xl sm:max-h-[80dvh]"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/20 px-4 py-3 sm:px-5">
              <div className="flex items-baseline gap-2">
                <h2 id={titleId} className="text-lg font-bold drop-shadow">마을 방명록</h2>
                <span className="text-xs tabular-nums text-white/80">{notes.length}장</span>
              </div>
              <button type="button" onClick={close} aria-label="방명록 닫기" className={`flex h-11 w-11 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25 ${focusStyle}`}>✕</button>
            </div>

            <div className="flex shrink-0 items-center gap-3 px-4 pt-2 text-xs sm:px-5">
              {canWrite && onMineOnlyChange && <label className="flex min-h-11 cursor-pointer items-center gap-2"><input type="checkbox" checked={mineOnly} onChange={(event) => onMineOnlyChange(event.target.checked)} className={`h-4 w-4 accent-orange-400 ${focusStyle}`} />내 쪽지만</label>}
              <button type="button" onClick={onRefresh} className={`ml-auto min-h-11 rounded-lg px-2 underline decoration-white/45 underline-offset-4 disabled:opacity-50 ${focusStyle}`} disabled={status === "loading"}>새로고침</button>
            </div>
            {cachedAt !== null && <p className="shrink-0 px-4 pb-2 text-xs leading-relaxed text-white/80 sm:px-5">{new Date(cachedAt).toLocaleString("ko-KR")}에 확인한 쪽지야.</p>}
            {status === "error" && <p role="status" className="shrink-0 px-4 pb-2 text-xs leading-relaxed text-orange-200 sm:px-5">최신 쪽지를 불러오지 못했어. <button type="button" onClick={onRefresh} className={`min-h-11 rounded px-1 underline ${focusStyle}`}>다시 시도</button></p>}
            {deleteError && <p role="alert" className="shrink-0 px-4 pb-2 text-xs leading-relaxed text-orange-200 sm:px-5">{deleteError}</p>}

            <div className="flex min-h-24 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
              {status === "loading" && notes.length === 0 && <p className="py-6 text-center text-sm text-white/80">쪽지를 불러오는 중…</p>}
              {status === "ready" && notes.length === 0 && (
                <p className="py-6 text-center text-sm leading-relaxed text-white/80">
                  {mineOnly ? "아직 남긴 쪽지가 없어." : "아직 아무도 쪽지를 걸지 않았어."}<br />
                  {canWrite ? "마을에 흔적을 남겨봐." : "연결되면 새 쪽지를 확인할 수 있어."}
                </p>
              )}
              {notes.map((note) => (
                <article key={note.id} className="shrink-0 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-sm">
                  <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span aria-hidden="true" className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: getNicknameColor(note.colorKey) }} />
                    <span className="text-xs font-medium">{note.nickname}</span>
                    <span className="text-[11px] text-white/80">{formatWhen(note.createdAt)}</span>
                    {canWrite && note.authorId === userId && <button type="button" onClick={() => onDelete(note.id)} aria-label={`${note.nickname}의 쪽지 지우기`} className={`-my-2 ml-auto min-h-11 rounded-lg px-2 text-xs text-white/80 hover:text-white ${focusStyle}`}>지우기</button>}
                  </div>
                  <p className="break-words text-sm font-normal leading-relaxed">{note.body}</p>
                </article>
              ))}
              {hasMore && <button type="button" onClick={onLoadOlder} disabled={isLoadingMore} className={`min-h-11 shrink-0 rounded-lg py-3 text-sm underline disabled:opacity-50 ${focusStyle}`}>{isLoadingMore ? "불러오는 중…" : "이전 쪽지 더 보기"}</button>}
            </div>

            {canWrite ? (
              <div className="flex shrink-0 flex-col gap-2 border-t border-white/20 px-4 py-3 sm:px-5">
                <textarea value={draft} onChange={(event) => setDraft(event.target.value.slice(0, MAX_NOTE_LENGTH))} disabled={isSubmitting} aria-label="마을에 남길 쪽지" aria-describedby={countId} placeholder="이 마을에 남기고 싶은 말을 적어봐" rows={2} maxLength={MAX_NOTE_LENGTH} className={`w-full resize-none rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-base font-normal leading-relaxed text-white placeholder:text-white/60 disabled:opacity-60 sm:text-sm ${focusStyle}`} />
                {writeError && <p role="alert" className="text-xs leading-relaxed text-orange-200">{writeError}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div id={countId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="tabular-nums text-white/80">{trimmed.length}/{MAX_NOTE_LENGTH}</span>
                    <span className={canAfford ? "text-white/80" : "text-orange-200"}>🎋 {NOTE_COST}개 필요 · 보유 {bambooCount}</span>
                  </div>
                  <button type="button" onClick={handleSubmit} disabled={!canSubmit} className={`min-h-11 flex-none rounded-full bg-orange-400 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-colors hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50 ${focusStyle}`}>{isSubmitting ? "거는 중…" : "쪽지 걸기"}</button>
                </div>
                {!canAfford && <p className="text-xs leading-relaxed text-white/80">대나무 숲에서 죽순을 모아오면 쪽지를 더 걸 수 있어.</p>}
              </div>
            ) : <p className="shrink-0 border-t border-white/20 px-4 py-3 text-xs leading-relaxed text-white/80 sm:px-5">지금은 쪽지를 읽을 수 있어. 온라인으로 연결되면 흔적을 남길 수 있어.</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
