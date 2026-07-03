import { ZoneLayout } from "./types";

/**
 * 시작 마을 존 — 울타리(±17) 안의 기존 판다 마을.
 * 좌표계: 마을 중심이 월드 원점.
 */

const fenceRange = (min: number, max: number) => {
  const arr: number[] = [];
  for (let v = min; v <= max; v += 2) arr.push(v);
  return arr;
};

export const VILLAGE: ZoneLayout = {
  id: "village",
  name: "판다 마을",
  bounds: { minX: -17.5, maxX: 17.5, minZ: -17.5, maxZ: 17.5 },

  trees: [
    { x: -10, z: -10, scale: 1.3, radius: 0.8 },
    { x: -14, z: -6, scale: 1.1, radius: 0.7 },
    { x: -13, z: -13, scale: 1.4, radius: 0.9 },
    { x: 8, z: -12, scale: 1.2, radius: 0.8, variant: "round" },
    { x: 12, z: -8, scale: 1.0, radius: 0.6 },
    { x: 13, z: -13, scale: 1.35, radius: 0.9 },
    { x: -12, z: 6, scale: 1.15, radius: 0.7, variant: "round" },
    { x: -10, z: 13, scale: 1.0, radius: 0.6, variant: "cherry" },
    { x: 14, z: 7, scale: 1.2, radius: 0.8, variant: "round" },
    { x: -3, z: 15, scale: 1.0, radius: 0.6, variant: "cherry" },
    { x: 4, z: 14, scale: 1.15, radius: 0.7, variant: "round" },
  ],

  rocks: [
    { x: 5, z: 4, scale: [2.2, 1.5, 2.4], rotation: 0.4, radius: 1.2 },
    { x: 5.8, z: 5.5, scale: [1.4, 1.0, 1.6], rotation: 1.2, radius: 0.8 },
    { x: -6, z: -2, scale: [2.8, 1.8, 2.4], rotation: 0.8, radius: 1.4 },
    { x: 9, z: -3, scale: [1.6, 1.2, 1.8], rotation: 2.1, radius: 0.9 },
    { x: -5, z: 8, scale: [2.0, 1.4, 2.0], rotation: 0.3, radius: 1.1 },
    { x: 0, z: 12, scale: [1.8, 1.2, 1.6], rotation: 1.5, radius: 0.9 },
  ],

  lanterns: [
    { x: -4, z: -2, radius: 0.6 },
    { x: 4, z: -2, radius: 0.6 },
    { x: 4, z: 12, radius: 0.6 },
    { x: -12, z: 5, radius: 0.6 },
  ],

  benches: [
    { x: 3.5, z: 5, rotation: -Math.PI / 2 },
    { x: -6.5, z: 5, rotation: Math.PI / 2 },
    { x: -1, z: 10.5, rotation: Math.PI },
  ],

  flowers: [
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
  ],

  ponds: [{ x: 8, z: 6, scale: 1.2, radius: 3.8 }],

  landmarkTrees: [
    { x: -1, y: 4, z: 6, scale: 4.2, rotation: Math.PI / 4, radius: 1.5 },
  ],

  houses: [
    {
      position: [0, 4.5, -7],
      scale: 5,
      box: { minX: -4.5, maxX: 4.5, minZ: -10.5, maxZ: -3.5 },
    },
  ],

  fences: [
    {
      dist: 17,
      lines: {
        south: fenceRange(-16, 8), // z = +17, 일부 구간만 (출입구)
        north: fenceRange(-16, 16), // z = -17
        west: fenceRange(-16, 16), // x = -17
        east: fenceRange(-16, 16), // x = +17
      },
    },
  ],

  signs: [
    // 남쪽 출입구 안내 (게이트 x 9.5~16.5 앞)
    { x: 10.3, z: 15, rotation: 0.15, radius: 0.4, label: "남쪽 들판" },
  ],

  grassPatches: [
    { x: 0, z: 0, width: 33, depth: 33, color: "#8fcf5a", opacity: 0.55 },
  ],

  dirtPatches: [
    { x: 0, z: -3, radius: 4.5 },
    { x: -2, z: 5, radius: 7 },
  ],

  stonePaths: [
    // 집 앞마당 -> 중앙 광장
    { start: [0, -2], end: [0, 4], width: 3, density: 2.5 },
    // 중앙 광장 -> 연못
    { start: [2, 5], end: [6, 6], width: 2, density: 2 },
    // 집 -> 왼쪽 나무 구역
    { start: [-2, -2], end: [-6, 0], width: 1.5, density: 1.8 },
  ],
};
