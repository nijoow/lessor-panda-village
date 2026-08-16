import { TreePlacement, ZoneLayout } from "./types";

/**
 * 야생림 존 — 플레이 구역 바깥을 채우는 경관 전용 침엽수림.
 *
 * 두 층으로 구성한다.
 *
 * 1. 중거리 뒷숲: 마을 울타리 너머와 존 사이의 빈 곳을 메워 깊이를 만든다.
 * 2. 경계 숲: 걸어갈 수 있는 한계(WORLD_BOUNDS ±74)를 지나서까지 이어지는
 *    숲의 띠. 바깥으로 갈수록 촘촘해지고, 걷기 한계보다 더 멀리 나무가
 *    보이기 때문에 플레이어가 멈춰 서도 "숲이 계속된다"로 읽힌다.
 *    안개(Scene의 fog)가 그 너머를 감춘다.
 *
 * bounds가 없어 진입 배너 대상이 아니며, 나무 충돌만 존재한다.
 */

// 결정적 산개(황금각) — min~max 사각 영역에 나무를 뿌림
const scatter = (
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  count: number,
  seed: number,
): TreePlacement[] => {
  const trees: TreePlacement[] = [];
  for (let i = 0; i < count; i++) {
    const fx = (Math.sin(seed * 12.9898 + i * 78.233) + 1) / 2;
    const fz = (Math.sin(seed * 39.346 + i * 11.135) + 1) / 2;
    trees.push({
      x: x0 + fx * (x1 - x0),
      z: z0 + fz * (z1 - z0),
      scale: 1.0 + ((i * 7 + seed) % 5) / 6,
      radius: 0.7,
    });
  }
  return trees;
};

/**
 * 사각 링 모양의 경계 숲.
 * 둘레는 황금각으로 고르게 훑고, 깊이는 제곱근 분포로 뽑아 바깥쪽이
 * 촘촘해지게 한다 (숲이 점점 깊어지는 인상).
 */
const boundaryRing = (
  inner: number,
  outer: number,
  count: number,
  seed: number,
): TreePlacement[] => {
  const trees: TreePlacement[] = [];
  for (let i = 0; i < count; i++) {
    const t = ((i * 0.618033988749 + seed * 0.137) % 1) * 4;
    const side = Math.floor(t);
    const along = (t - side) * 2 - 1; // -1 ~ 1

    const f = (Math.sin(seed * 12.9898 + i * 78.233) + 1) / 2;
    const r = inner + (outer - inner) * Math.sqrt(f);
    const cross = r * along;

    const x = side === 0 ? cross : side === 1 ? r : side === 2 ? cross : -r;
    const z = side === 0 ? -r : side === 1 ? cross : side === 2 ? r : cross;

    trees.push({
      x,
      z,
      scale: 1.0 + ((i * 7 + seed) % 5) / 6,
      radius: 0.7,
    });
  }
  return trees;
};

export const WILDS: ZoneLayout = {
  id: "wilds",
  name: "야생림",

  trees: [
    // ---------- 중거리 뒷숲 ----------
    // 마을 북쪽 뒷숲 (울타리 너머 경관)
    ...scatter(-38, 38, -52, -22, 22, 1),
    // 마을 동서 측면 틈새
    ...scatter(-52, -24, -18, 8, 8, 5),
    ...scatter(24, 52, -18, 10, 8, 6),

    // ---------- 경계 숲 ----------
    // 걷기 한계(±74) 안쪽에서 시작해 바깥(±88)까지 이어진다
    ...boundaryRing(60, 88, 130, 7),
    ...boundaryRing(64, 84, 110, 8),
  ],

  rocks: [
    { x: -55, z: 20, scale: [2.6, 1.7, 2.3], rotation: 0.8, radius: 1.4 },
    { x: 55, z: 24, scale: [2.2, 1.5, 2.0], rotation: 2.0, radius: 1.2 },
    { x: 10, z: 58, scale: [2.8, 1.8, 2.4], rotation: 1.3, radius: 1.5 },
    { x: -30, z: 58, scale: [1.9, 1.3, 1.8], rotation: 0.2, radius: 1.0 },
    { x: 38, z: 55, scale: [2.0, 1.4, 1.9], rotation: 2.7, radius: 1.1 },
  ],
};
