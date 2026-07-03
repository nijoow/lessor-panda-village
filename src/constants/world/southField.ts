import { ZoneLayout } from "./types";

/**
 * 남쪽 들판 존 — 마을 남쪽 출입구(게이트 x 9.5~16.5, z 17) 밖으로
 * 이어지는 흙길과 넓은 초원. z 17~38, x -15~17 영역을 사용하며
 * WORLD_BOUNDS(±39)와 기존 80×80 지면 안에 들어간다.
 *
 * 길 동선: 게이트(13, 18) → (8, 26) → (-4, 32)
 */
export const SOUTH_FIELD: ZoneLayout = {
  id: "south-field",
  name: "남쪽 들판",

  trees: [
    // 서쪽 가장자리
    { x: -12, z: 21, scale: 1.2, radius: 0.8 },
    { x: -14, z: 27, scale: 1.0, radius: 0.6 },
    { x: -12, z: 34, scale: 1.3, radius: 0.85 },
    // 남쪽 가장자리
    { x: -6, z: 37, scale: 1.1, radius: 0.7 },
    { x: 3, z: 37.5, scale: 1.25, radius: 0.8 },
    { x: 11, z: 36, scale: 1.0, radius: 0.6 },
    // 동쪽 가장자리
    { x: 15, z: 31, scale: 1.2, radius: 0.8 },
    { x: 16.5, z: 24, scale: 1.1, radius: 0.7 },
  ],

  rocks: [
    { x: -8, z: 24, scale: [2.0, 1.4, 2.0], rotation: 0.7, radius: 1.1 },
    { x: 12, z: 28, scale: [1.5, 1.1, 1.7], rotation: 1.9, radius: 0.85 },
    { x: 2, z: 35, scale: [2.4, 1.6, 2.2], rotation: 0.2, radius: 1.25 },
  ],

  // 길가 석등 (길 옆으로 비켜 배치)
  lanterns: [
    { x: 12.8, z: 21, radius: 0.6 },
    { x: 9.5, z: 27, radius: 0.6 },
    { x: 1.5, z: 31, radius: 0.6 },
  ],

  // 들판을 바라보는 쉼터 벤치 (길 끝)
  benches: [{ x: -6, z: 33.5, rotation: Math.PI }],

  flowers: [
    // 초원 산개 (길 회랑은 비움)
    { pos: [-9, 0, 20], color: "#ff6b8a" },
    { pos: [-5, 0, 22], color: "#f9ca24" },
    { pos: [-2, 0, 25], color: "#a78bfa" },
    { pos: [-7, 0, 28], color: "#ff99cc" },
    { pos: [-10, 0, 31], color: "#ffb347" },
    { pos: [-3, 0, 35], color: "#ff6b8a" },
    { pos: [1, 0, 33], color: "#f9ca24" },
    { pos: [5, 0, 30], color: "#ff99cc" },
    { pos: [4, 0, 24], color: "#a78bfa" },
    { pos: [1, 0, 21], color: "#ffb347" },
    { pos: [6, 0, 20], color: "#ff6b8a" },
    { pos: [9, 0, 23], color: "#a78bfa" },
    { pos: [13, 0, 25], color: "#f9ca24" },
    { pos: [14, 0, 29], color: "#ff99cc" },
    { pos: [10, 0, 32], color: "#ffb347" },
    { pos: [7, 0, 35], color: "#ff6b8a" },
    { pos: [12, 0, 34], color: "#a78bfa" },
    { pos: [-13, 0, 24], color: "#f9ca24" },
    { pos: [-14, 0, 31], color: "#ff99cc" },
    { pos: [-9, 0, 36], color: "#ffb347" },
  ],

  signs: [
    // 게이트를 나서면 보이는 귀환 안내
    { x: 15, z: 20, rotation: -0.25, radius: 0.4, label: "판다 마을" },
  ],

  grassPatches: [
    // 초원 톤 (마을 잔디보다 옅고 넓게)
    { x: 1, z: 28, width: 30, depth: 19, color: "#a2db66", opacity: 0.4 },
  ],

  dirtPatches: [
    { x: 13, z: 18.5, radius: 2 },
    { x: 10.5, z: 22, radius: 2.4 },
    { x: 8, z: 26, radius: 2.6 },
    { x: 2, z: 29, radius: 2.8 },
    { x: -4, z: 32, radius: 2.4 },
  ],

  stonePaths: [
    { start: [13, 17.5], end: [8, 26], width: 2, density: 1.6 },
    { start: [8, 26], end: [-4, 32], width: 2, density: 1.6 },
  ],
};
