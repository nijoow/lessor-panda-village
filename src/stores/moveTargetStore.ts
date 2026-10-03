import { create } from "zustand";
import type { MoveRequest } from "@/domain/player";

interface MoveTargetState {
  request: MoveRequest | null;
  /** 바닥 클릭/터치 시 이동 요청 발행 (Ground → Player) */
  requestMove: (x: number, z: number) => void;
}

export const useMoveTargetStore = create<MoveTargetState>((set) => ({
  request: null,
  requestMove: (x, z) =>
    set((state) => ({
      request: { x, z, requestId: (state.request?.requestId ?? 0) + 1 },
    })),
}));
