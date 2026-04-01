"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getNicknameColor } from "@/utils/color";
import { chatStore } from "@/stores/chatStore";

interface Props {
  onSendMessage: (message: string) => void;
  onFocusChange?: (isFocused: boolean) => void;
}

export const ChatHUD = ({ onSendMessage, onFocusChange }: Props) => {
  // chatStore를 구독하여 HUD만 리렌더링 (Scene는 영향 없음)
  const messages = useSyncExternalStore(
    chatStore.subscribe,
    chatStore.getChatLog,
    chatStore.getChatLog,
  );
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(() => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
    }
    setInputValue("");
    setIsTyping(false);
    onFocusChange?.(false);
  }, [inputValue, onSendMessage, onFocusChange]);

  // 엔터 키로 채팅 토글
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (!isTyping) {
          setIsTyping(true);
          onFocusChange?.(true);
          // 다음 틱에서 포커스 (상태 반영 후)
          setTimeout(() => inputRef.current?.focus(), 10);
        } else {
          handleSubmit();
        }
      } else if (e.key === "Escape" && isTyping) {
        setIsTyping(false);
        onFocusChange?.(false);
        setInputValue("");
      }
    };

    // 화면 클릭 시 채팅 닫기
    const handleWindowClick = (e: MouseEvent) => {
      if (isTyping && inputRef.current && !inputRef.current.contains(e.target as Node)) {
        // 입력창 외부 클릭 시 (단, 입력창 자체 클릭은 제외)
        setIsTyping(false);
        onFocusChange?.(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleWindowClick);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleWindowClick);
    };
  }, [isTyping, onFocusChange, handleSubmit]);

  // 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="absolute inset-0 pointer-events-none z-50 flex flex-col justify-end p-6">
      {/* Chat Log */}
      <div 
        ref={scrollRef}
        className="mb-4 w-80 max-h-48 overflow-y-auto pointer-events-auto custom-scrollbar flex flex-col gap-1 pr-2"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={`${msg.id}-${msg.timestamp}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-black/20 backdrop-blur-md rounded-lg px-3 py-1.5 border border-white/10"
            >
              <span 
                className="font-black text-xs mr-2 drop-shadow-sm"
                style={{ color: getNicknameColor(msg.id) }}
              >
                {msg.nickname}
              </span>
              <span className="text-white text-sm font-medium leading-tight">
                {msg.message}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input Overlay */}
      <AnimatePresence>
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="pointer-events-auto mb-20 md:mb-0"
          >
            <div className="relative w-full max-w-lg bg-white/10 backdrop-blur-2xl rounded-2xl border border-white/20 p-2 shadow-2xl flex items-center gap-3">
              <span className="pl-4 text-white/50 font-bold select-none text-sm">TALK</span>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="마을 사람들에게 인사해보세요..."
                className="bg-transparent border-none outline-none text-white w-full py-2 font-bold placeholder:text-white/30"
              />
              <div className="text-[10px] text-white/40 font-black pr-4 uppercase select-none">
                Enter to send
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};
