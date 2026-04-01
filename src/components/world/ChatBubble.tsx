"use client";

import { Html } from "@react-three/drei";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  message: string;
  timestamp: number;
}

export const ChatBubble = ({ message, timestamp }: Props) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      const showTimer = setTimeout(() => setVisible(true), 10);
      const hideTimer = setTimeout(() => {
        setVisible(false);
      }, 5000);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [message, timestamp]);

  if (!message) return null;

  return (
    <Html
      position={[0, 3.8, 0.6]}
      center
      distanceFactor={10}
      pointerEvents="none"
      zIndexRange={[0, 10]}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            className="flex flex-col items-center"
          >
            {/* Bubble Container */}
            <div className="relative px-5 py-3 bg-white/95 rounded-[24px] shadow-lg border border-white/60 w-max max-w-[280px] min-w-[80px]">
              <p className="text-sky-900 text-xl font-bold leading-normal text-center whitespace-pre-wrap break-words">
                {message}
              </p>

              {/* Tail Arrow */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-white/95" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Html>
  );
};
