import { create } from "zustand";

import type { GuestbookNote, GuestbookStatus } from "@/domain/guestbook";

/**
 * 방명록 상태.
 * useGuestbook(네트워크)이 notes/status를 채우고, Player(useFrame)가 근접
 * 감지를 기록하며, NoticeBoard(3D)와 GuestbookPanel(UI)이 구독합니다.
 */
interface GuestbookState {
  notes: GuestbookNote[];
  status: GuestbookStatus;
  cachedAt: number | null;
  applySnapshot: (notes: GuestbookNote[], status: GuestbookStatus, cachedAt: number | null) => void;
  /** 상호작용 거리 안의 게시판 인덱스 (NOTICE_BOARDS 기준, 없으면 null) */
  nearbyBoardIndex: number | null;
  /** 방명록 패널 열림 — 열려 있는 동안 플레이어 입력이 잠깁니다 */
  isOpen: boolean;
  setStatus: (status: GuestbookStatus) => void;
  setNearbyBoard: (index: number | null) => void;
  open: () => void;
  close: () => void;
}

export const useGuestbookStore = create<GuestbookState>((set) => ({
  notes: [],
  status: "idle",
  cachedAt: null,
  applySnapshot: (notes, status, cachedAt) => set({ notes, status, cachedAt }),
  nearbyBoardIndex: null,
  isOpen: false,
  setStatus: (status) =>
    set((state) => (state.status === status ? state : { status })),
  setNearbyBoard: (index) =>
    set((state) =>
      state.nearbyBoardIndex === index ? state : { nearbyBoardIndex: index },
    ),
  open: () => set((state) => (state.isOpen ? state : { isOpen: true })),
  close: () => set((state) => (state.isOpen ? { isOpen: false } : state)),
}));
