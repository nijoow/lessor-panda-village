/**
 * 월드 오브젝트 배치의 단일 소스(Single Source of Truth).
 * 비주얼(Environment/World)과 충돌 판정(collision.ts)이 모두
 * 이 파일의 데이터에서 파생되므로, 오브젝트를 옮길 때 여기만 수정하면 됩니다.
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

// ---------- 나무 ----------
export interface TreePlacement extends CollisionCircle {
  scale: number;
}

export const TREES: TreePlacement[] = [
  { x: -10, z: -10, scale: 1.3, radius: 0.8 },
  { x: -14, z: -6, scale: 1.1, radius: 0.7 },
  { x: -13, z: -13, scale: 1.4, radius: 0.9 },
  { x: 8, z: -12, scale: 1.2, radius: 0.8 },
  { x: 12, z: -8, scale: 1.0, radius: 0.6 },
  { x: 13, z: -13, scale: 1.35, radius: 0.9 },
  { x: -12, z: 6, scale: 1.15, radius: 0.7 },
  { x: -10, z: 13, scale: 1.0, radius: 0.6 },
  { x: 14, z: 7, scale: 1.2, radius: 0.8 },
  { x: -3, z: 15, scale: 1.0, radius: 0.6 },
  { x: 4, z: 14, scale: 1.15, radius: 0.7 },
];

// ---------- 바위 ----------
export interface RockPlacement extends CollisionCircle {
  scale: [number, number, number];
  rotation: number;
}

export const ROCKS: RockPlacement[] = [
  { x: 5, z: 4, scale: [2.2, 1.5, 2.4], rotation: 0.4, radius: 1.2 },
  { x: 5.8, z: 5.5, scale: [1.4, 1.0, 1.6], rotation: 1.2, radius: 0.8 },
  { x: -6, z: -2, scale: [2.8, 1.8, 2.4], rotation: 0.8, radius: 1.4 },
  { x: 9, z: -3, scale: [1.6, 1.2, 1.8], rotation: 2.1, radius: 0.9 },
  { x: -5, z: 8, scale: [2.0, 1.4, 2.0], rotation: 0.3, radius: 1.1 },
  { x: 0, z: 12, scale: [1.8, 1.2, 1.6], rotation: 1.5, radius: 0.9 },
];

// ---------- 석등 ----------
export const LANTERNS: CollisionCircle[] = [
  { x: -4, z: -2, radius: 0.6 },
  { x: 4, z: -2, radius: 0.6 },
  { x: 4, z: 12, radius: 0.6 },
  { x: -12, z: 5, radius: 0.6 },
];

// ---------- 벤치 ----------
export interface BenchPlacement {
  x: number;
  z: number;
  rotation: number;
}

export const BENCHES: BenchPlacement[] = [
  { x: 3.5, z: 5, rotation: -Math.PI / 2 },
  { x: -6.5, z: 5, rotation: Math.PI / 2 },
  { x: -1, z: 10.5, rotation: Math.PI },
];

// 좌석 2.2 x 0.8 크기 기준, ±90° 회전 시 긴 축이 z 방향
const benchBox = ({ x, z, rotation }: BenchPlacement): CollisionBox => {
  const halfW = 1.1;
  const halfD = 0.4;
  const rotated = Math.abs(Math.abs(rotation) - Math.PI / 2) < 0.01;
  return rotated
    ? { minX: x - halfD, maxX: x + halfD, minZ: z - halfW, maxZ: z + halfW }
    : { minX: x - halfW, maxX: x + halfW, minZ: z - halfD, maxZ: z + halfD };
};

// ---------- 연못 ----------
export const POND = { x: 8, z: 6, scale: 1.2, radius: 3.8 };

// ---------- 중앙 고목 (Ancient Tree) ----------
export const LANDMARK_TREE = {
  x: -1,
  y: 4,
  z: 6,
  scale: 4.2,
  rotation: Math.PI / 4,
  radius: 1.5,
};

// ---------- 집 ----------
export const HOUSE = {
  position: [0, 4.5, -7] as [number, number, number],
  scale: 5,
  box: { minX: -4.5, maxX: 4.5, minZ: -10.5, maxZ: -3.5 } as CollisionBox,
};

// ---------- 울타리 (시각용 세그먼트 좌표, 충돌은 collision.ts에서 라인 판정) ----------
const fenceRange = (min: number, max: number) => {
  const arr: number[] = [];
  for (let v = min; v <= max; v += 2) arr.push(v);
  return arr;
};

export const FENCE_DIST = 17;
export const FENCE_LINES = {
  south: fenceRange(-16, 8), // z = +17, 일부 구간만 (출입구)
  north: fenceRange(-16, 16), // z = -17
  west: fenceRange(-16, 16), // x = -17
  east: fenceRange(-16, 16), // x = +17
};

// ---------- 꽃 (충돌 없음) ----------
export const FLOWERS: Array<{ pos: [number, number, number]; color: string }> =
  [
    // 왼쪽 구역
    { pos: [-5, 0, 0], color: "#ff6b8a" },
    { pos: [-6, 0, 2.5], color: "#ffb347" },
    { pos: [-7, 0, -1], color: "#a78bfa" },
    { pos: [-4, 0, 4], color: "#f9ca24" },
    { pos: [-8, 0, 4], color: "#ff99cc" },
    { pos: [-3, 0, 6], color: "#ff6b8a" },
    { pos: [-9, 0, 1], color: "#ffb347" },
    { pos: [-5, 0, 8], color: "#a78bfa" },
    { pos: [-2, 0, 7], color: "#f9ca24" },
    { pos: [-10, 0, 6], color: "#ff99cc" },
    { pos: [-11, 0, 3], color: "#ff6b8a" },
    { pos: [-7, 0, 9], color: "#ffb347" },
    // 오른쪽 구역
    { pos: [5, 0, 0], color: "#a78bfa" },
    { pos: [6, 0, 2.5], color: "#f9ca24" },
    { pos: [7, 0, -1], color: "#ff99cc" },
    { pos: [4, 0, 4], color: "#ff6b8a" },
    { pos: [8, 0, 4], color: "#ffb347" },
    { pos: [3, 0, 6], color: "#a78bfa" },
    { pos: [9, 0, 1], color: "#f9ca24" },
    { pos: [5, 0, 8], color: "#ff99cc" },
    { pos: [2, 0, 7], color: "#ff6b8a" },
    { pos: [10, 0, 6], color: "#ffb347" },
    { pos: [11, 0, 3], color: "#a78bfa" },
    { pos: [7, 0, 9], color: "#f9ca24" },
    // 앞쪽 구역
    { pos: [0, 0, 5], color: "#ff99cc" },
    { pos: [2, 0, 3], color: "#ff6b8a" },
    { pos: [-2, 0, 3], color: "#ffb347" },
    { pos: [4, 0, 7], color: "#a78bfa" },
    { pos: [-4, 0, 7], color: "#f9ca24" },
    { pos: [0, 0, 10], color: "#ff99cc" },
    { pos: [3, 0, 11], color: "#ff6b8a" },
    { pos: [-3, 0, 11], color: "#ffb347" },
    { pos: [6, 0, 12], color: "#a78bfa" },
    { pos: [-6, 0, 12], color: "#f9ca24" },
    // 집 왼쪽
    { pos: [-5, 0, -5], color: "#ff99cc" },
    { pos: [-7, 0, -6], color: "#ff6b8a" },
    { pos: [-9, 0, -4], color: "#ffb347" },
    { pos: [-10, 0, -7], color: "#a78bfa" },
    // 집 오른쪽
    { pos: [5, 0, -5], color: "#f9ca24" },
    { pos: [7, 0, -6], color: "#ff99cc" },
    { pos: [9, 0, -4], color: "#ff6b8a" },
    { pos: [10, 0, -7], color: "#ffb347" },
  ];

// ---------- 월드 경계 ----------
export const WORLD_BOUNDS = {
  min: -39,
  max: 39,
};

// ─────────────────────────────────────────────
// 충돌 판정용 파생 데이터 (collision.ts에서 사용)
// ─────────────────────────────────────────────
export const COLLISION_TREES: CollisionCircle[] = TREES;
export const COLLISION_ROCKS: CollisionCircle[] = ROCKS;
export const COLLISION_LANTERNS: CollisionCircle[] = LANTERNS;
export const COLLISION_BENCHES: CollisionBox[] = BENCHES.map(benchBox);
export const COLLISION_POND: CollisionCircle = POND;
export const COLLISION_LANDMARK: CollisionCircle = LANDMARK_TREE;
export const COLLISION_HOUSE: CollisionBox = HOUSE.box;
