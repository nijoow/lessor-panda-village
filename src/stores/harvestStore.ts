import { create } from "zustand";

/** 수확된 대나무가 다시 자라나기까지의 시간 */
export const BAMBOO_RESPAWN_MS = 30_000;

/**
 * 대나무 수확 상태.
 * Player(useFrame)가 근접 감지·수확을 수행하고, UI(InteractionPrompt·
 * InventoryHUD)와 BambooField(비주얼)가 구독합니다.
 *
 * 충돌 조회용 Set은 이 소유자 안에 숨기고, 소비자는 isHarvested를 사용한다.
 * 렌더 구독에는 불변 배열 또는 revision을 제공한다.
 */
interface HarvestState {
  /** 모은 죽순 개수 */
  bambooCount: number;
  /** 리스폰 대기 중인 대나무의 BAMBOO 전역 인덱스 (반응형) */
  harvestedIds: readonly number[];
  revision: number;
  isHarvested: (index: number) => boolean;
  /** 상호작용 거리 안의 대나무 인덱스 (없으면 null) */
  nearbyBambooIndex: number | null;
  /** 수확 요청 카운터 (E 키 외에 모바일 버튼에서 사용) */
  harvestRequestId: number;
  setNearbyBamboo: (index: number | null) => void;
  requestHarvest: () => void;
  harvest: (index: number) => void;
  /** 죽순 소비 (방명록 쪽지 등). 부족하면 아무것도 하지 않고 false */
  spendBamboo: (amount: number) => boolean;
}

export const useHarvestStore = create<HarvestState>((set, get) => {
  const harvested = new Set<number>();
  return {
    // 처음 온 방문자도 쪽지 한 장은 걸 수 있도록 마을이 죽순 하나를 준다.
    // 두 번째 쪽지부터는 대나무 숲까지 걸어가야 한다.
    bambooCount: 1,
    harvestedIds: [],
    revision: 0,
    isHarvested: (index) => harvested.has(index),
    nearbyBambooIndex: null,
    harvestRequestId: 0,
    setNearbyBamboo: (index) =>
      set((state) =>
        state.nearbyBambooIndex === index ? state : { nearbyBambooIndex: index },
      ),
    requestHarvest: () =>
      set((state) => ({ harvestRequestId: state.harvestRequestId + 1 })),
    harvest: (index) => {
      const { harvestedIds, bambooCount, revision } = get();
      if (!Number.isInteger(index) || index < 0 || harvested.has(index)) return;
      harvested.add(index);
      set({
        bambooCount: bambooCount + 1,
        harvestedIds: [...harvestedIds, index],
        revision: revision + 1,
      });
      // 리스폰 — 비주얼과 충돌 조회를 같은 변경 경계에서 복구
      setTimeout(() => {
        const state = get();
        harvested.delete(index);
        set({ harvestedIds: state.harvestedIds.filter((i) => i !== index), revision: state.revision + 1 });
      }, BAMBOO_RESPAWN_MS);
    },
    spendBamboo: (amount) => {
      const { bambooCount } = get();
      if (!Number.isInteger(amount) || amount <= 0 || bambooCount < amount) return false;
      set({ bambooCount: bambooCount - amount });
      return true;
    },
  };
});
