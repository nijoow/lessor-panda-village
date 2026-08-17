import { create } from "zustand";

/** 게시판에 물리적으로 걸리는 쪽지 수 (나머지는 패널 목록에서만 보인다) */
export const BOARD_SLOT_COUNT = 12;

/** 쪽지 한 장의 죽순 가격 */
export const NOTE_COST = 1;

export interface GuestbookNote {
  id: string;
  body: string;
  authorId: string;
  nickname: string;
  /** epoch ms (서버 시각) */
  createdAt: number;
}

type GuestbookStatus = "idle" | "loading" | "ready" | "error";

/**
 * 방명록 상태.
 * useGuestbook(네트워크)이 notes/status를 채우고, Player(useFrame)가 근접
 * 감지를 기록하며, NoticeBoard(3D)와 GuestbookPanel(UI)이 구독합니다.
 */
interface GuestbookState {
  notes: GuestbookNote[];
  status: GuestbookStatus;
  /** 상호작용 거리 안의 게시판 인덱스 (NOTICE_BOARDS 기준, 없으면 null) */
  nearbyBoardIndex: number | null;
  /** 방명록 패널 열림 — 열려 있는 동안 플레이어 입력이 잠깁니다 */
  isOpen: boolean;
  setNotes: (notes: GuestbookNote[]) => void;
  setStatus: (status: GuestbookStatus) => void;
  setNearbyBoard: (index: number | null) => void;
  open: () => void;
  close: () => void;
}

export const useGuestbookStore = create<GuestbookState>((set) => ({
  notes: [],
  status: "idle",
  nearbyBoardIndex: null,
  isOpen: false,
  setNotes: (notes) => set({ notes }),
  setStatus: (status) =>
    set((state) => (state.status === status ? state : { status })),
  setNearbyBoard: (index) =>
    set((state) =>
      state.nearbyBoardIndex === index ? state : { nearbyBoardIndex: index },
    ),
  open: () => set((state) => (state.isOpen ? state : { isOpen: true })),
  close: () => set((state) => (state.isOpen ? { isOpen: false } : state)),
}));
