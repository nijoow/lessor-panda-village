import { ZoneLayout } from "./types";

/**
 * 강가 산책로 존 — 남쪽 들판에서 서쪽으로 이어지는 강과 나무다리.
 * 강은 폴리라인 리본(River 컴포넌트)으로 흐르고, 다리 발자국 안의
 * 충돌 샘플이 자동 제외되어 다리 위로만 건널 수 있다.
 * 동선: 들판 (-4,32) → 강둑 (-20,29.5) → 다리 (-33,28) → 건너편 쉼터 (-42,27)
 */
export const RIVERSIDE: ZoneLayout = {
  id: "riverside",
  name: "강가 산책로",
  bounds: { minX: -50, maxX: -14, minZ: 12, maxZ: 48 },

  // 강: 월드 남서쪽을 북→남으로 흐르는 물줄기 (다리 밑을 지나감)
  rivers: [
    {
      // 강은 지면 평면을 완전히 가로질러야 한다. 걷기 한계(z -30~62)만
      // 넘겨서는 부족하고, Ground가 여유까지 포함해 z -60~92를 덮으므로
      // 그 바깥(-64 ~ 96)까지 이어야 잔디 위에서 물길이 끊기지 않는다.
      points: [
        [-26, -64],
        [-26.5, -56],
        [-27, -48],
        [-27.5, -40],
        [-29, -32],
        [-30.5, -24],
        [-31.5, -16],
        [-31, -8],
        [-29.5, -1],
        [-30.5, 6],
        [-32.5, 12],
        [-33.5, 20],
        [-34, 28],
        [-33.5, 36],
        [-32.5, 44],
        [-30, 52],
        [-27, 58],
        [-25.5, 64],
        [-24.5, 72],
        [-23.5, 80],
        [-23, 88],
        [-22.5, 96],
      ],
      width: 5,
    },
  ],

  bridges: [
    // 다리 발자국 안은 강 충돌 샘플이 제외됨 — 유일한 도하 지점
    { x: -33.8, z: 28, rotation: 0, length: 10.5, width: 3 },
  ],

  trees: [
    // 동쪽 강둑
    { x: -22, z: 20, scale: 1.15, radius: 0.7, variant: "round" },
    { x: -25, z: 38, scale: 1.25, radius: 0.8, variant: "cherry" },
    { x: -19, z: 42, scale: 1.0, radius: 0.6, variant: "round" },
    // 건너편 (서쪽)
    { x: -43, z: 20, scale: 1.3, radius: 0.85, variant: "round" },
    { x: -46, z: 30, scale: 1.1, radius: 0.7, variant: "cherry" },
    { x: -44, z: 40, scale: 1.2, radius: 0.8, variant: "round" },
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
