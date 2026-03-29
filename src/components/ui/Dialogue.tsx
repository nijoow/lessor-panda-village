import React from 'react';

interface DialogueProps {
  message: string;
  isVisible: boolean;
}

export const Dialogue = ({ message, isVisible }: DialogueProps) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-12 left-0 w-full flex justify-center z-50 pointer-events-none px-4">
      <div className="bg-white/70 backdrop-blur-lg border border-white/40 shadow-xl rounded-2xl px-8 py-5 max-w-2xl w-full flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center shrink-0 text-2xl">
          🐼
        </div>
        <div className="flex-1">
          <p className="text-sky-900 font-bold text-lg leading-snug">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
};
