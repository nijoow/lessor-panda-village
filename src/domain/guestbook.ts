export const MAX_NOTE_LENGTH = 80;
export const NOTE_PAGE_SIZE = 50;
export const BOARD_SLOT_COUNT = 12;
export const NOTE_COST = 1;

export interface GuestbookNote {
  id: string;
  body: string;
  authorId: string | null;
  colorKey: string;
  createdAtCursor: string;
  nickname: string;
  createdAt: number;
}

export type GuestbookStatus = "idle" | "loading" | "ready" | "error";
