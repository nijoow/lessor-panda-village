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

// 나무 위치 및 충돌 반경 (Environment.tsx 기반)
export const COLLISION_TREES: CollisionCircle[] = [
  { x: -10, z: -10, radius: 0.8 },
  { x: -14, z: -6, radius: 0.7 },
  { x: -13, z: -13, radius: 0.9 },
  { x: 8, z: -12, radius: 0.8 },
  { x: 12, z: -8, radius: 0.6 },
  { x: 13, z: -13, radius: 0.9 },
  { x: -12, z: 6, radius: 0.7 },
  { x: -10, z: 13, radius: 0.6 },
  { x: 14, z: 7, radius: 0.8 },
  { x: -3, z: 15, radius: 0.6 },
  { x: 4, z: 14, radius: 0.7 },
];

// 바위 위치 및 충돌 반경
export const COLLISION_ROCKS: CollisionCircle[] = [
  { x: 5, z: 4, radius: 1.2 },
  { x: 5.8, z: 5.5, radius: 0.8 },
  { x: -6, z: -2, radius: 1.4 },
  { x: 9, z: -3, radius: 0.9 },
  { x: -5, z: 8, radius: 1.1 },
  { x: 0, z: 12, radius: 0.9 },
];

// 집 충돌 박스 (중심 [0, -7], scale 5 기준 대략적인 크기)
export const COLLISION_HOUSE: CollisionBox = {
  minX: -4.5,
  maxX: 4.5,
  minZ: -10.5,
  maxZ: -3.5,
};

// 월드 경계 (바깥쪽 80x80 잔디 안쪽)
export const WORLD_BOUNDS = {
  min: -39,
  max: 39,
};

// 중앙 고목 (Ancient Tree)
export const COLLISION_LANDMARK: CollisionCircle = {
  x: -6,
  z: 5,
  radius: 1.5,
};

// 벤치 충돌 박스
export const COLLISION_BENCHES: CollisionBox[] = [
  { minX: -4.4, maxX: -3.6, minZ: 3.9, maxZ: 6.1 }, // 왼쪽 벤치
  { minX: 3.6, maxX: 4.4, minZ: 3.9, maxZ: 6.1 },  // 오른쪽 벤치
  { minX: -1.1, maxX: 1.1, minZ: 8.6, maxZ: 9.4 },  // 아래쪽 벤치
];

// 평온한 연못 충돌 (Pond)
export const COLLISION_POND: CollisionCircle = {
  x: 8,
  z: 6,
  radius: 3.8,
};

// 석등 충돌 (Lanterns)
export const COLLISION_LANTERNS: CollisionCircle[] = [
  { x: -4, z: -2, radius: 0.6 },
  { x: 4, z: -2, radius: 0.6 },
  { x: 4, z: 12, radius: 0.6 },
  { x: -12, z: 5, radius: 0.6 },
];
