import { TreePlacement, ZoneLayout } from "./types";

/**
 * 야생림 존 — 플레이 구역 바깥을 채우는 경관 전용 침엽수림.
 * 마을 울타리 너머와 월드 가장자리에 숲의 깊이감을 만들어
 * 세계가 지평선까지 이어지는 느낌을 준다. bounds가 없어
 * 진입 배너 대상이 아니며, 나무 충돌만 존재한다.
 */

// 결정적 산개(황금각) — min~max 사각 링 영역에 나무를 뿌림
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

export const WILDS: ZoneLayout = {
  id: "wilds",
  name: "야생림",

  trees: [
    // 마을 북쪽 뒷숲 (울타리 너머 경관)
    ...scatter(-38, 38, -52, -22, 22, 1),
    // 서쪽 외곽 (강가 너머)
    ...scatter(-72, -54, -10, 44, 12, 2),
    // 동쪽 외곽 (대숲 너머)
    ...scatter(54, 72, 0, 46, 12, 3),
    // 남쪽 지평선 (들판·대숲·강가 너머)
    ...scatter(-46, 48, 54, 72, 18, 4),
    // 마을 동서 측면 틈새
    ...scatter(-52, -24, -18, 8, 8, 5),
    ...scatter(24, 52, -18, 10, 8, 6),
  ],

  rocks: [
    { x: -55, z: 20, scale: [2.6, 1.7, 2.3], rotation: 0.8, radius: 1.4 },
    { x: 55, z: 24, scale: [2.2, 1.5, 2.0], rotation: 2.0, radius: 1.2 },
    { x: 10, z: 58, scale: [2.8, 1.8, 2.4], rotation: 1.3, radius: 1.5 },
    { x: -30, z: 58, scale: [1.9, 1.3, 1.8], rotation: 0.2, radius: 1.0 },
    { x: 38, z: 55, scale: [2.0, 1.4, 1.9], rotation: 2.7, radius: 1.1 },
  ],
};
