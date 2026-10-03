"use client";

import { MAX_CHAT_LENGTH } from "@/domain/world";

import { useCallback, useEffect, useRef, useState } from "react";
import { getNicknameColor } from "@/utils/color";
import { useChatStore } from "@/stores/chatStore";
import { useGuestbookStore } from "@/stores/guestbookStore";

interface Props {
  onSendMessage: (message: string) => void;
  onFocusChange?: (isFocused: boolean) => void;
  readOnly?: boolean;
}

export const ChatHUD = ({ onSendMessage, onFocusChange, readOnly = false }: Props) => {
  const messages = useChatStore((state) => state.chatLog);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);

  const closeChat = useCallback(() => {
    setIsTyping(false);
    onFocusChange?.(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [onFocusChange]);

  const openChat = useCallback(() => {
    setIsTyping(true);
    onFocusChange?.(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [onFocusChange]);

  const handleSubmit = () => {
    if (readOnly || composingRef.current || !inputValue.trim()) return;
    onSendMessage(inputValue.trim());
    setInputValue("");
    closeChat();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229 || useGuestbookStore.getState().isOpen) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, button, select, [contenteditable='true']")) return;
      if (event.key === "Enter" && !isTyping) {
        event.preventDefault();
        openChat();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTyping, openChat]);

  useEffect(() => {
    if (!isTyping) return;
    const handleOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setIsTyping(false);
        onFocusChange?.(false);
      }
    };
    window.addEventListener("pointerdown", handleOutside);
    return () => window.removeEventListener("pointerdown", handleOutside);
  }, [isTyping, onFocusChange]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isTyping]);

  return (
    <div ref={containerRef} className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 z-50 pointer-events-none sm:bottom-8 sm:left-8 sm:right-auto sm:w-[min(36rem,calc(100vw-13rem))]">
      <div
        ref={scrollRef}
        role="log"
        aria-label="마을 대화"
        aria-live="polite"
        className={`mb-4 flex max-h-48 w-full max-w-[280px] flex-col items-start gap-2 overflow-y-auto pr-4 sm:mb-6 sm:max-h-64 sm:w-96 ${isTyping ? "pointer-events-auto" : "pointer-events-none"}`}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {messages.slice(isTyping ? -30 : -3).map((message) => (
          <p key={message.messageId} className="glass-card max-w-[90%] break-words rounded-2xl rounded-tl-none border-white/20 px-4 py-2.5 text-sm font-bold leading-relaxed text-white shadow-xl transition-colors hover:bg-white/30 selection:bg-orange-400/50">
            <span className="mr-2 font-black uppercase tracking-wider drop-shadow-md" style={{ color: getNicknameColor(message.id) }}>{message.nickname}</span>
            {message.message}
          </p>
        ))}
      </div>
      {isTyping ? (
        <form
          onSubmit={(event) => { event.preventDefault(); handleSubmit(); }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || composingRef.current) {
              if (event.key === "Enter") event.preventDefault();
              return;
            }
            if (event.key === "Escape") { event.preventDefault(); closeChat(); }
          }}
          className="glass-premium pointer-events-auto relative mb-16 rounded-[2.5rem] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] sm:mb-0"
        >
          <div className="flex items-center gap-1 pl-1 pr-1 sm:gap-4 sm:pl-2.5 sm:pr-5">
            <div className="hidden h-10 w-10 flex-none items-center justify-center rounded-full bg-orange-400 shadow-lg shadow-orange-500/30 sm:flex" aria-hidden="true">
              <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zm-4 0H9v2h2V9z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              ref={inputRef}
              aria-label="채팅 메시지"
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => { composingRef.current = false; }}
              placeholder={readOnly ? "연결되면 대화할 수 있어" : "인사를 건네봐"}
              maxLength={MAX_CHAT_LENGTH}
              readOnly={readOnly}
              className="min-w-0 flex-1 rounded-lg border-none bg-transparent px-2 py-3.5 text-base font-bold text-white placeholder:text-white/40 sm:px-0 sm:text-lg"
            />
            <button type="submit" disabled={readOnly || !inputValue.trim()} className="min-h-11 min-w-11 shrink-0 rounded-full bg-orange-400 px-3 text-sm font-bold text-white shadow-lg shadow-orange-500/20 disabled:opacity-40">전송</button>
            <button type="button" onClick={closeChat} className="min-h-11 min-w-11 shrink-0 rounded-full px-2 text-sm font-bold text-white/70 hover:bg-white/10">닫기</button>
          </div>
          {readOnly && <p role="status" className="px-5 pb-2 text-xs text-white/70">마을 연결을 기다리고 있어.</p>}
        </form>
      ) : (
        <button ref={triggerRef} type="button" onClick={openChat} aria-label="대화하기" className="pointer-events-auto flex min-h-11 w-fit max-w-[calc(100%-8rem)] items-center gap-4 rounded-full border border-white/5 bg-black/10 px-4 py-4 text-left backdrop-blur-sm transition-all hover:bg-black/20 sm:w-full sm:max-w-none sm:px-6">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 sm:text-[10px]">
            <span className="hidden sm:inline">Press [Enter] to talk</span>
            <span className="inline sm:hidden">Touch to talk</span>
          </span>
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-orange-400 shadow-[0_0_8px_#fb923c]" />
        </button>
      )}
    </div>
  );
};
