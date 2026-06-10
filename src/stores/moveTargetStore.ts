import { create } from "zustand";

export interface MoveRequest {
  x: number;
  z: number;
  /** 같은 좌표를 연속 클릭해도 새 요청으로 인식되도록 하는 구분자 */
  requestId: number;
}

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
