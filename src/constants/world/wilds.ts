import { WORLD_BOUNDS } from "./bounds";
import { TreePlacement, ZoneLayout } from "./types";

/**
 * 야생림 존 — 플레이 구역 바깥을 채우는 경관 전용 침엽수림.
 *
 * 두 층으로 구성한다.
 *
 * 1. 중거리 뒷숲: 마을 울타리 너머와 존 사이의 빈 곳을 메워 깊이를 만든다.
 * 2. 경계 숲: 걷기 한계(WORLD_BOUNDS) 사각형을 감싸는 숲의 띠. 한계보다
 *    조금 안쪽에서 시작해 바깥까지 이어지고 바깥으로 갈수록 촘촘해져서,
 *    플레이어가 멈춰 서도 "숲이 깊어 더 못 간다"로 읽힌다.
 *    안개(Scene의 fogExp2)가 그 너머를 감춘다.
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

const hash01 = (i: number, seed: number) => {
  const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * 걷기 한계 직사각형을 감싸는 경계 숲의 띠.
 *
 * 둘레를 균등 분할한 뒤 한 칸 폭만큼 결정적으로 흐트러뜨린다. 순수 난수로
 * 뿌리면 같은 그루 수로도 벽 한쪽에 십수 유닛짜리 구멍이 생겨 월드의 끝이
 * 그대로 보인다 — 줄 서 보이지 않으면서 빈틈도 없어야 한다.
 *
 * 벽에서 바깥으로 나가는 깊이는 제곱근 분포로 뽑아 바깥쪽이 촘촘해지고
 * (숲이 점점 깊어지는 인상), inset만큼은 벽 안쪽에서 시작해 플레이어가
 * 숲에 발을 들인 채로 막힌다.
 */
const boundaryBelt = (
  inset: number,
  outset: number,
  count: number,
  seed: number,
): TreePlacement[] => {
  const b = WORLD_BOUNDS;
  // 모서리가 끊기지 않도록 각 변을 outset만큼 늘린 사각형의 둘레를 훑는다
  const width = b.maxX - b.minX + outset * 2;
  const depthSpan = b.maxZ - b.minZ + outset * 2;
  const perimeter = (width + depthSpan) * 2;
  const step = perimeter / count;

  const trees: TreePlacement[] = [];
  for (let i = 0; i < count; i++) {
    const jittered = (i + 0.5) * step + (hash01(i, seed) - 0.5) * step;
    const u = ((jittered % perimeter) + perimeter) % perimeter;

    // 벽 기준 바깥 방향 깊이 (-inset: 안쪽, +outset: 바깥쪽)
    const depth =
      -inset + (inset + outset) * Math.sqrt(hash01(i + 0.37, seed));

    let x: number;
    let z: number;
    if (u < width) {
      x = b.minX - outset + u;
      z = b.minZ - depth;
    } else if (u < width + depthSpan) {
      x = b.maxX + depth;
      z = b.minZ - outset + (u - width);
    } else if (u < width * 2 + depthSpan) {
      x = b.maxX + outset - (u - width - depthSpan);
      z = b.maxZ + depth;
    } else {
      x = b.minX - depth;
      z = b.maxZ + outset - (u - width * 2 - depthSpan);
    }

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
    ...scatter(-38, 38, -42, -22, 18, 1),
    // 마을 동서 측면 틈새
    ...scatter(-52, -24, -18, 8, 8, 5),
    ...scatter(24, 52, -18, 10, 8, 6),

    // ---------- 경계 숲 ----------
    // 바깥으로 물러나며 깊어지는 숲
    ...boundaryBelt(4, 14, 100, 7),
    // 벽에 바짝 붙는 울. 깊이 분포가 제곱근이라 바깥층만으로는 벽 선이
    // 성겨져 5~10 유닛짜리 구멍으로 월드 밖이 비친다. 이 층이 그걸 막는다.
    ...boundaryBelt(5, 2, 100, 8),
  ],

  rocks: [
    { x: -55, z: 20, scale: [2.6, 1.7, 2.3], rotation: 0.8, radius: 1.4 },
    { x: 55, z: 24, scale: [2.2, 1.5, 2.0], rotation: 2.0, radius: 1.2 },
    { x: 10, z: 58, scale: [2.8, 1.8, 2.4], rotation: 1.3, radius: 1.5 },
    { x: -30, z: 58, scale: [1.9, 1.3, 1.8], rotation: 0.2, radius: 1.0 },
    { x: 38, z: 55, scale: [2.0, 1.4, 1.9], rotation: 2.7, radius: 1.1 },
  ],
};
