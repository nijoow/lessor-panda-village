import { BambooPlacement, ZoneLayout } from "./types";

/**
 * 대나무 숲 존 — 남쪽 들판 교차로에서 동쪽으로 이어지는 대숲.
 * 중앙 공터를 대나무 군락이 둘러싸고, 군락 사이 오솔길로 통행한다.
 * 동선: 들판 (8,26) → 입구 (20,28.5) → 공터 (33,31)
 */

// 군락 중심 주위로 결정적(비랜덤) 지터를 준 줄기들을 생성
const clump = (
  cx: number,
  cz: number,
  count: number,
  seed: number,
): BambooPlacement[] => {
  const stalks: BambooPlacement[] = [];
  for (let i = 0; i < count; i++) {
    const a = seed * 2.399 + i * 2.618; // 황금각 분산
    const r = 0.35 + ((i * 37 + seed * 13) % 10) / 14;
    stalks.push({
      x: cx + Math.cos(a) * r,
      z: cz + Math.sin(a) * r,
      radius: 0.13,
      height: 4.2 + ((i * 53 + seed * 29) % 10) / 4,
    });
  }
  return stalks;
};

export const BAMBOO_GROVE: ZoneLayout = {
  id: "bamboo-grove",
  name: "대나무 숲",
  bounds: { minX: 18, maxX: 50, minZ: 16, maxZ: 50 },

  // 공터(33,31)를 둘러싸는 군락 배치 — 군락 사이 2m+ 통로 유지
  bamboo: [
    // 북쪽 벽
    ...clump(24, 21, 6, 1),
    ...clump(29, 19.5, 7, 2),
    ...clump(35, 20, 6, 3),
    ...clump(41, 21.5, 7, 4),
    // 동쪽 벽
    ...clump(45, 26, 6, 5),
    ...clump(47, 32, 7, 6),
    ...clump(45.5, 38, 6, 7),
    // 남쪽 벽
    ...clump(41, 43, 7, 8),
    ...clump(34.5, 45, 6, 9),
    ...clump(28, 43.5, 7, 10),
    ...clump(22.5, 40, 6, 11),
    // 서쪽 (입구 양옆)
    ...clump(20.5, 33.5, 5, 12),
    ...clump(21, 23.5, 5, 13),
    // 공터 안 포인트 군락
    ...clump(37.5, 27, 4, 14),
    ...clump(28.5, 35.5, 4, 15),
  ],

  rocks: [
    { x: 25, z: 29, scale: [1.6, 1.1, 1.5], rotation: 0.9, radius: 0.9 },
    { x: 39, z: 35.5, scale: [2.1, 1.4, 1.9], rotation: 2.2, radius: 1.1 },
  ],

  lanterns: [
    { x: 21, z: 27, radius: 0.6 },
    { x: 33, z: 28.5, radius: 0.6 },
  ],

  // 공터 쉼터 (대숲을 바라보는 벤치)
  benches: [{ x: 33.5, z: 34.5, rotation: Math.PI }],

  flowers: [
    { pos: [23, 0, 31], color: "#a78bfa" },
    { pos: [27, 0, 26], color: "#ff99cc" },
    { pos: [31, 0, 24.5], color: "#f9ca24" },
    { pos: [36.5, 0, 23.5], color: "#a78bfa" },
    { pos: [42, 0, 26.5], color: "#ff6b8a" },
    { pos: [43.5, 0, 31.5], color: "#f9ca24" },
    { pos: [41.5, 0, 39], color: "#ff99cc" },
    { pos: [36, 0, 41.5], color: "#a78bfa" },
    { pos: [29.5, 0, 40], color: "#ffb347" },
    { pos: [24.5, 0, 37], color: "#ff6b8a" },
  ],

  signs: [
    // 입구 안내 (들판 → 대숲 길목)
    { x: 19, z: 30.5, rotation: -0.3, radius: 0.4, label: "대나무 숲" },
  ],

  grassPatches: [
    // 대숲 특유의 짙은 초록 바닥
    { x: 33, z: 32, width: 30, depth: 28, color: "#7dcc5e", opacity: 0.45 },
  ],

  dirtPatches: [
    { x: 20, z: 28.5, radius: 2.2 },
    { x: 26, z: 30, radius: 2.4 },
    { x: 33, z: 31, radius: 3.2 }, // 중앙 공터
  ],

  stonePaths: [
    { start: [14, 27], end: [26, 30], width: 2, density: 1.5 },
    { start: [26, 30], end: [33, 31], width: 2, density: 1.5 },
  ],
};
