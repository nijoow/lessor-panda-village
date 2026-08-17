import { create } from "zustand";

/**
 * 플레이어가 현재 서 있는 존 상태.
 * Player가 매 프레임 위치로 판정해 갱신하고, ZoneBanner가 구독해
 * 존이 바뀔 때 진입 배너를 띄운다.
 */
interface ZoneState {
  currentZoneId: string | null;
  currentZoneName: string | null;
  /** 배너 재생 트리거 (같은 존 재진입도 구분하기 위한 증가 카운터) */
  enterCount: number;
  /**
   * 플레이어 실시간 위치 — 미니맵 등 rAF 소비자용.
   * 매 프레임 값만 바뀌는 안정 참조 객체라 리렌더를 유발하지 않는다.
   */
  playerPos: { x: number; z: number; ry: number };
  /**
   * 제자리 이모트 재생 여부.
   * 위치가 그대로라 이동 감지로는 잡히지 않지만 그림자 캐스터의 자세는
   * 바뀌므로, Scene이 그림자맵 갱신 여부를 판단할 때 함께 본다.
   * playerPos와 같은 안정 참조 객체라 리렌더를 유발하지 않는다.
   */
  playerPose: { emoting: boolean };
  setZone: (id: string | null, name: string | null) => void;
}

export const useZoneStore = create<ZoneState>((set) => ({
  currentZoneId: null,
  currentZoneName: null,
  enterCount: 0,
  playerPos: { x: 0, z: 0, ry: 0 },
  playerPose: { emoting: false },
  setZone: (id, name) =>
    set((state) =>
      state.currentZoneId === id
        ? state
        : {
            currentZoneId: id,
            currentZoneName: name,
            enterCount: state.enterCount + 1,
          },
    ),
}));
