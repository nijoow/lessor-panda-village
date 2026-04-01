import { ChatMessage } from '@/hooks/useMultiplayer';

/**
 * React State를 거치지 않는 초고속 채팅 저장소.
 * useFrame 내부에서 직접 참조하여 리렌더링 없이 말풍선을 제어합니다.
 */

// 플레이어별 최신 채팅 메시지 (말풍선용)
const lastMessageMap = new Map<string, ChatMessage>();

// HUD용 채팅 로그 (최근 20개)
let chatLog: ChatMessage[] = [];

// HUD 구독자 (ChatHUD만 사용)
type Listener = () => void;
const listeners = new Set<Listener>();

export const chatStore = {
  /** 새 메시지 추가 (useMultiplayer에서 호출) */
  addMessage: (msg: ChatMessage) => {
    lastMessageMap.set(msg.id, msg);
    chatLog = [...chatLog.slice(-19), msg];
    // HUD 리스너에게만 알림 (Scene 리렌더링 없음)
    listeners.forEach((fn) => fn());
  },

  /** 특정 플레이어의 최신 채팅 가져오기 (useFrame에서 호출) */
  getLastMessage: (id: string): ChatMessage | undefined => {
    return lastMessageMap.get(id);
  },

  /** HUD용 전체 로그 가져오기 */
  getChatLog: (): ChatMessage[] => {
    return chatLog;
  },

  /** HUD 구독 (ChatHUD 전용) */
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
