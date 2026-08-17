import { create } from "zustand";
import { EmoteAnim } from "@/constants/playerAnimations";

/**
 * 월드 오브젝트 상호작용 상태.
 * Player(useFrame)가 근접 감지 결과를 기록하고, UI(InteractionPrompt)가 구독합니다.
 * 앉기/일어서기 토글은 requestId 카운터로 전달해 stale 요청 재실행을 방지합니다
 * (moveTargetStore와 동일한 패턴).
 */
interface InteractionState {
  /** 상호작용 가능 거리 안의 벤치 인덱스 (없으면 null) */
  nearbyBenchIndex: number | null;
  /** 현재 벤치에 앉아 있는지 (UI 라벨 분기용) */
  isSitting: boolean;
  /** 앉기/일어서기 토글 요청 카운터 (E 키 외에 모바일 버튼에서 사용) */
  toggleSitRequestId: number;
  /** 이모트 재생 요청 (EmoteBar 버튼 → Player가 requestId로 소비) */
  emoteRequest: { anim: EmoteAnim; requestId: number } | null;
  setNearbyBench: (index: number | null) => void;
  setSitting: (sitting: boolean) => void;
  requestToggleSit: () => void;
  requestEmote: (anim: EmoteAnim) => void;
}

export const useInteractionStore = create<InteractionState>((set) => ({
  nearbyBenchIndex: null,
  isSitting: false,
  toggleSitRequestId: 0,
  emoteRequest: null,
  setNearbyBench: (index) =>
    set((state) =>
      state.nearbyBenchIndex === index ? state : { nearbyBenchIndex: index },
    ),
  setSitting: (sitting) =>
    set((state) => (state.isSitting === sitting ? state : { isSitting: sitting })),
  requestToggleSit: () =>
    set((state) => ({ toggleSitRequestId: state.toggleSitRequestId + 1 })),
  requestEmote: (anim) =>
    set((state) => ({
      emoteRequest: { anim, requestId: (state.emoteRequest?.requestId ?? 0) + 1 },
    })),
}));
