import { create } from "zustand";

/** 수확된 대나무가 다시 자라나기까지의 시간 */
export const BAMBOO_RESPAWN_MS = 30_000;

/**
 * 대나무 수확 상태.
 * Player(useFrame)가 근접 감지·수확을 수행하고, UI(InteractionPrompt·
 * InventoryHUD)와 BambooField(비주얼)가 구독합니다.
 *
 * harvestedSet은 collision.ts가 매 충돌 체크마다 O(1)로 조회하는
 * 비반응형 미러입니다 — React 구독은 harvestedIds(불변 배열)로만.
 */
interface HarvestState {
  /** 모은 죽순 개수 */
  bambooCount: number;
  /** 리스폰 대기 중인 대나무의 BAMBOO 전역 인덱스 (반응형) */
  harvestedIds: number[];
  /** collision.ts 전용 O(1) 미러 (참조 안정, 제자리 갱신) */
  harvestedSet: Set<number>;
  /** 상호작용 거리 안의 대나무 인덱스 (없으면 null) */
  nearbyBambooIndex: number | null;
  /** 수확 요청 카운터 (E 키 외에 모바일 버튼에서 사용) */
  harvestRequestId: number;
  setNearbyBamboo: (index: number | null) => void;
  requestHarvest: () => void;
  harvest: (index: number) => void;
}

export const useHarvestStore = create<HarvestState>((set, get) => ({
  bambooCount: 0,
  harvestedIds: [],
  harvestedSet: new Set<number>(),
  nearbyBambooIndex: null,
  harvestRequestId: 0,
  setNearbyBamboo: (index) =>
    set((state) =>
      state.nearbyBambooIndex === index ? state : { nearbyBambooIndex: index },
    ),
  requestHarvest: () =>
    set((state) => ({ harvestRequestId: state.harvestRequestId + 1 })),
  harvest: (index) => {
    const { harvestedSet, harvestedIds, bambooCount } = get();
    if (harvestedSet.has(index)) return;
    harvestedSet.add(index);
    set({
      bambooCount: bambooCount + 1,
      harvestedIds: [...harvestedIds, index],
    });
    // 리스폰 — 비주얼(harvestedIds)과 충돌(harvestedSet)을 함께 복구
    setTimeout(() => {
      const state = get();
      state.harvestedSet.delete(index);
      set({ harvestedIds: state.harvestedIds.filter((i) => i !== index) });
    }, BAMBOO_RESPAWN_MS);
  },
}));
