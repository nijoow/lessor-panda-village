import type { PlayerPose } from "@/domain/player";

// 멀티플레이어 공용 타입 (네트워크로 주고받는 데이터 형상)

export type MultiplayerConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error";

export interface WorldSession {
  mode: "online" | "offline";
  userId: string;
  nickname: string;
  worldKey: string;
}

export interface PlayerState extends PlayerPose {
  id: string;
  nickname: string;
  lastUpdated: number;
}

export interface ChatMessage {
  /** 보낸 플레이어의 id */
  id: string;
  nickname: string;
  message: string;
  timestamp: number;
}
