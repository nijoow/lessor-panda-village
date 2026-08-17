import { create } from "zustand";
import { ChatMessage } from "@/types/multiplayer";

const MAX_LOG_SIZE = 20;

export interface ChatLogEntry extends ChatMessage {
  /** 리스트 렌더링용 로컬 고유 키 (네트워크로 전송되지 않음) */
  messageId: string;
}

interface ChatState {
  /** HUD용 채팅 로그 (최근 20개) */
  chatLog: ChatLogEntry[];
  /** 플레이어별 최신 메시지 (말풍선용) */
  lastMessages: Record<string, ChatMessage>;
  addMessage: (msg: ChatMessage) => void;
  /** 퇴장한 플레이어의 말풍선 데이터 정리 (메모리 누수 방지) */
  removePlayer: (id: string) => void;
  /** 다른 방의 채팅이 새 방에 남지 않도록 전체 초기화 */
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chatLog: [],
  lastMessages: {},

  addMessage: (msg) =>
    set((state) => ({
      chatLog: [
        ...state.chatLog.slice(-(MAX_LOG_SIZE - 1)),
        { ...msg, messageId: crypto.randomUUID() },
      ],
      lastMessages: { ...state.lastMessages, [msg.id]: msg },
    })),

  removePlayer: (id) =>
    set((state) => {
      if (!(id in state.lastMessages)) return state;
      const lastMessages = { ...state.lastMessages };
      delete lastMessages[id];
      return { lastMessages };
    }),

  reset: () => set({ chatLog: [], lastMessages: {} }),
}));
