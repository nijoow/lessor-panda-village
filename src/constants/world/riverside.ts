import { ZoneLayout } from "./types";

/**
 * 강가 산책로 존 — 남쪽 들판에서 서쪽으로 이어지는 개울과 나무다리.
 * 개울은 바위 테두리 연못(Pond) 체인으로 표현하며, z 26~30 구간을
 * 비워 다리가 놓인다 (물 충돌이 없는 유일한 도하 지점).
 * 동선: 들판 (-4,32) → 강둑 (-20,29.5) → 다리 (-33,28) → 건너편 쉼터 (-42,27)
 */
export const RIVERSIDE: ZoneLayout = {
  id: "riverside",
  name: "강가 산책로",
  bounds: { minX: -50, maxX: -14, minZ: 12, maxZ: 48 },

  // 개울: 남북으로 흐르는 연못 체인 (다리 구간 z 26.5~29.5는 비움)
  ponds: [
    { x: -32.5, z: 14, scale: 1.1, radius: 3.5 },
    { x: -33.5, z: 21, scale: 1.2, radius: 3.8 },
    { x: -34, z: 35, scale: 1.2, radius: 3.8 },
    { x: -33, z: 42, scale: 1.1, radius: 3.5 },
    { x: -32.5, z: 48, scale: 1.0, radius: 3.2 },
  ],

  bridges: [
    // 다리 구간(z≈28)은 연못 충돌이 없어 통행 가능 — 다리는 비주얼
    { x: -33.5, z: 28, rotation: 0, length: 10, width: 3 },
  ],

  trees: [
    // 동쪽 강둑
    { x: -22, z: 20, scale: 1.15, radius: 0.7 },
    { x: -25, z: 38, scale: 1.25, radius: 0.8 },
    { x: -19, z: 42, scale: 1.0, radius: 0.6 },
    // 건너편 (서쪽)
    { x: -43, z: 20, scale: 1.3, radius: 0.85 },
    { x: -46, z: 30, scale: 1.1, radius: 0.7 },
    { x: -44, z: 40, scale: 1.2, radius: 0.8 },
  ],

  rocks: [
    { x: -26, z: 24, scale: [1.8, 1.2, 1.7], rotation: 0.6, radius: 1.0 },
    { x: -39, z: 33, scale: [1.5, 1.0, 1.4], rotation: 1.7, radius: 0.85 },
    { x: -21, z: 33, scale: [2.2, 1.5, 2.0], rotation: 2.8, radius: 1.2 },
  ],

  lanterns: [
    { x: -19, z: 28, radius: 0.6 },
    { x: -29, z: 30.5, radius: 0.6 },
    { x: -38.5, z: 26, radius: 0.6 },
  ],

  // 건너편 쉼터: 개울을 바라보는 벤치
  benches: [{ x: -42, z: 25, rotation: -Math.PI / 2 }],

  flowers: [
    { pos: [-18, 0, 24], color: "#ff99cc" },
    { pos: [-22.5, 0, 27.5], color: "#a78bfa" },
    { pos: [-24, 0, 31.5], color: "#f9ca24" },
    { pos: [-27.5, 0, 26], color: "#ff6b8a" },
    { pos: [-28, 0, 33], color: "#ffb347" },
    { pos: [-37.5, 0, 29.5], color: "#a78bfa" },
    { pos: [-40, 0, 31], color: "#ff99cc" },
    { pos: [-41.5, 0, 22.5], color: "#f9ca24" },
    { pos: [-44.5, 0, 26], color: "#ff6b8a" },
    { pos: [-38.5, 0, 23], color: "#ffb347" },
    { pos: [-17.5, 0, 31.5], color: "#f9ca24" },
    { pos: [-20.5, 0, 37], color: "#ff99cc" },
  ],

  signs: [
    // 들판 → 강가 길목 안내
    { x: -14.5, z: 27.5, rotation: 0.3, radius: 0.4, label: "강가 산책로" },
  ],

  grassPatches: [
    // 물가의 싱그러운 잔디 톤
    { x: -32, z: 30, width: 34, depth: 32, color: "#96d968", opacity: 0.35 },
  ],

  dirtPatches: [
    { x: -14, z: 30.5, radius: 2 },
    { x: -20, z: 29.5, radius: 2.4 },
    { x: -27, z: 28.8, radius: 2.2 },
    { x: -40, z: 27.5, radius: 2.4 },
  ],

  stonePaths: [
    { start: [-10, 31.5], end: [-27, 28.8], width: 2, density: 1.4 },
    { start: [-39, 27.8], end: [-43, 27], width: 1.8, density: 1.6 },
  ],
};
