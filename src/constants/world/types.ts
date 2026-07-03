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
/** 나무 아키타입 — 존 분위기에 맞게 혼합 배치 */
export type TreeVariant = "pine" | "round" | "cherry";

export interface TreePlacement extends CollisionCircle {
  scale: number;
  /** 생략 시 pine */
  variant?: TreeVariant;
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

/** 나무 표지판 (기둥 충돌 있음) */
export interface SignPlacement extends CollisionCircle {
  rotation: number;
  label: string;
}

/** 대나무 줄기 (인스턴싱 렌더, 기둥 충돌) */
export interface BambooPlacement extends CollisionCircle {
  height: number;
}

/** 나무다리 (비주얼 전용 — 강 충돌 샘플이 다리 밑에서 자동 제외됨) */
export interface BridgePlacement {
  x: number;
  z: number;
  /** 0이면 길이 방향이 x축 */
  rotation: number;
  length: number;
  width: number;
}

/**
 * 강 — 중심선 폴리라인을 따라 리본 지오메트리로 렌더된다.
 * 충돌은 중심선을 일정 간격 샘플링한 원들로 파생되며,
 * 다리 발자국 안의 샘플은 제외되어 도하가 가능하다.
 */
export interface RiverSpec {
  points: Array<[number, number]>;
  width: number;
}

// ---------- 바닥 스타일 ----------
/** 존 바닥에 겹쳐 그리는 잔디 색 패치 (사각) */
export interface GrassPatch {
  x: number;
  z: number;
  width: number;
  depth: number;
  color: string;
  opacity: number;
}

/** 흙바닥 원형 패치 */
export interface DirtPatch {
  x: number;
  z: number;
  radius: number;
}

/** 징검돌 길 (Ground의 StonePath로 렌더) */
export interface StonePathSpec {
  start: [number, number];
  end: [number, number];
  width?: number;
  density?: number;
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
/** 모든 배치 필드는 선택적 — 존은 자기 구역에 있는 것만 서술한다. */
export interface ZoneLayout {
  id: string;
  name: string;
  /** 존 진입 배너·미니맵용 영역. 경관 전용 존은 생략 */
  bounds?: CollisionBox;
  trees?: TreePlacement[];
  rocks?: RockPlacement[];
  lanterns?: CollisionCircle[];
  benches?: BenchPlacement[];
  flowers?: FlowerPlacement[];
  ponds?: PondPlacement[];
  landmarkTrees?: LandmarkTreePlacement[];
  houses?: HousePlacement[];
  fences?: FenceLayout[];
  signs?: SignPlacement[];
  bamboo?: BambooPlacement[];
  bridges?: BridgePlacement[];
  rivers?: RiverSpec[];
  grassPatches?: GrassPatch[];
  dirtPatches?: DirtPatch[];
  stonePaths?: StonePathSpec[];
}
