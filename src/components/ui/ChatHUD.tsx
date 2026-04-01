"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getNicknameColor } from "@/utils/color";
import { chatStore } from "@/stores/chatStore";

interface Props {
  onSendMessage: (message: string) => void;
  onFocusChange?: (isFocused: boolean) => void;
}

export const ChatHUD = ({ onSendMessage, onFocusChange }: Props) => {
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (!isTyping) {
          setIsTyping(true);
          onFocusChange?.(true);
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

    const handleWindowClick = (e: MouseEvent) => {
      if (
        isTyping &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  return (
    <div className="absolute inset-0 pointer-events-none z-50 flex flex-col justify-end p-8">
      {/* Chat Log Viewport */}
      <div
        ref={scrollRef}
        className="mb-6 w-96 max-h-64 overflow-y-auto pointer-events-auto scroll-smooth flex flex-col gap-2 pr-4 scrollbar-hideMask"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={`${msg.id}-${msg.timestamp}-${idx}`}
              initial={{ opacity: 0, x: -30, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", damping: 20, stiffness: 150 }}
              className="group flex flex-col items-start gap-1 max-w-[90%]"
            >
              <div className="glass-card px-4 py-2.5 rounded-2xl rounded-tl-none border-white/20 shadow-xl group-hover:bg-white/30 transition-colors">
                <p className="text-white text-sm font-bold leading-relaxed selection:bg-orange-400/50">
                  <span
                    className="font-black uppercase tracking-wider drop-shadow-md mr-2"
                    style={{ color: getNicknameColor(msg.id) }}
                  >
                    {msg.nickname}
                  </span>{" "}
                  {msg.message}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input Section */}
      <div className="relative w-full max-w-xl self-start pointer-events-auto">
        <AnimatePresence>
          {isTyping ? (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="relative p-1.5 glass-premium rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] group"
            >
              <div className="flex items-center gap-4 pl-2.5 pr-5">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-400 shadow-lg shadow-orange-500/30 flex-none">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zm-4 0H9v2h2V9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="마을 사람들과 소통해보세요"
                  maxLength={100}
                  className="bg-transparent border-none outline-none text-white w-full py-3.5 text-lg font-bold placeholder:text-white/20"
                />
                <div className="flex flex-col items-end opacity-40 select-none">
                  <span className="text-[14px] text-white font-black tracking-widest uppercase">
                    ENTER
                  </span>
                  <span className="text-[9px] text-white font-bold tracking-tight">
                    TO SEND
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-6 py-4 flex items-center gap-4 bg-black/10 backdrop-blur-sm rounded-full border border-white/5 cursor-pointer hover:bg-black/20 transition-all group"
              onClick={() => {
                setIsTyping(true);
                onFocusChange?.(true);
                setTimeout(() => inputRef.current?.focus(), 10);
              }}
            >
              <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">
                Press [Enter] to talk
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_8px_#fb923c] animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
