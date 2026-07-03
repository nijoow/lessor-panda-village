/**
 * 존(zone) 레이아웃 공통 스키마.
 *
 * 월드는 여러 존의 배열로 구성되며, 각 존 파일은 자기 구역의 배치
 * 데이터만 서술합니다. 비주얼(Environment/World)과 충돌 판정
 * (collision.ts)은 모두 존 데이터의 집계(index.ts)에서 파생되므로,
 * 오브젝트를 옮기거나 존을 추가할 때 존 파일만 수정하면 됩니다.
 */

export interface CollisionCircle {
  x: number;
  z: number;
  radius: number;
}

export interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// ---------- 반복 배치 오브젝트 ----------
export interface TreePlacement extends CollisionCircle {
  scale: number;
}

export interface RockPlacement extends CollisionCircle {
  scale: [number, number, number];
  rotation: number;
}

export interface BenchPlacement {
  x: number;
  z: number;
  rotation: number;
}

export interface FlowerPlacement {
  pos: [number, number, number];
  color: string;
}

// ---------- 단일 배치 오브젝트 ----------
export interface PondPlacement extends CollisionCircle {
  scale: number;
}

/** 중앙 고목처럼 GLB로 렌더되는 대형 나무 */
export interface LandmarkTreePlacement extends CollisionCircle {
  y: number;
  scale: number;
  rotation: number;
}

export interface HousePlacement {
  position: [number, number, number];
  scale: number;
  box: CollisionBox;
}

/**
 * 사각 울타리. lines는 측면별 세그먼트 중심 좌표(간격 2) — 비주얼과
 * 충돌 스팬(min-1.5 ~ max+1.5)이 모두 여기서 파생됩니다.
 * 출입구는 해당 측면의 좌표를 비워서 표현합니다.
 */
export interface FenceLayout {
  dist: number;
  lines: {
    south: number[];
    north: number[];
    west: number[];
    east: number[];
  };
}

// ---------- 존 ----------
export interface ZoneLayout {
  id: string;
  name: string;
  trees: TreePlacement[];
  rocks: RockPlacement[];
  lanterns: CollisionCircle[];
  benches: BenchPlacement[];
  flowers: FlowerPlacement[];
  ponds: PondPlacement[];
  landmarkTrees: LandmarkTreePlacement[];
  houses: HousePlacement[];
  fences: FenceLayout[];
}
