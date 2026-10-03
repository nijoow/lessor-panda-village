import { TREES, FLOWERS, FENCES, GRASS_PATCHES, DIRT_PATCHES, COLLISION_PONDS, COLLISION_HOUSES } from "@/constants/world";
import { staticInstance } from "./instanceData";

// ---------- 그라운드 클러터 (풀숲·자갈) — 결정적 산개 ----------
const rand01 = (seed: number) => {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * 나무 한 그루의 결정적 변주.
 *
 * 같은 지오메트리를 300그루 가까이 인스턴싱하면 숲 전체가 복제 붙여넣기처럼
 * 보인다. 개체마다 방향과 비율을 흔들어 준다.
 *
 * 한 그루의 몸통·수관이 여러 <Instances> 그룹에 나뉘어 있으므로 같은
 * 인덱스는 반드시 같은 값을 내야 조각이 어긋나지 않는다. species로 수종을
 * 갈라 침엽수와 활엽수가 같은 패턴을 반복하지 않게 한다.
 */
const treeVariation = (i: number, species: number) => ({
  spin: rand01(i * 3.7 + species) * Math.PI * 2,
  wide: 0.85 + rand01(i * 5.9 + species + 11) * 0.32,
  deep: 0.85 + rand01(i * 8.3 + species + 23) * 0.32,
  tall: 0.9 + rand01(i * 17.3 + species + 71) * 0.24,
  tiltX: (rand01(i * 11.1 + species + 37) - 0.5) * 0.26,
  tiltZ: (rand01(i * 13.7 + species + 53) - 0.5) * 0.26,
});

// 수종별 시드 (겹치면 서로 같은 변주가 나온다)
const PINE_SEED = 0;

const ROUND_SEED = 400;

const CHERRY_SEED = 900;

const isClear = (x: number, z: number) => {
  for (const d of DIRT_PATCHES) {
    const dx = x - d.x;
    const dz = z - d.z;
    if (dx * dx + dz * dz < (d.radius + 0.4) ** 2) return false;
  }
  for (const p of COLLISION_PONDS) {
    const dx = x - p.x;
    const dz = z - p.z;
    if (dx * dx + dz * dz < (p.radius + 0.6) ** 2) return false;
  }
  for (const h of COLLISION_HOUSES) {
    if (x > h.minX - 1 && x < h.maxX + 1 && z > h.minZ - 1 && z < h.maxZ + 1)
      return false;
  }
  return true;
};

interface TuftData {
  x: number;
  z: number;
  s: number;
  rot: number;
  shade: number;
}

// 존 잔디 패치마다 면적 비례로 풀숲을 뿌린다 (물·흙길·집 회피)
const GRASS_TUFTS: TuftData[] = (() => {
  const tufts: TuftData[] = [];
  GRASS_PATCHES.forEach((g, gi) => {
    const count = Math.min(320, Math.floor(g.width * g.depth * 0.28));
    for (let i = 0; i < count; i++) {
      const seed = gi * 1000 + i;
      const x = g.x + (rand01(seed) - 0.5) * g.width;
      const z = g.z + (rand01(seed + 0.5) - 0.5) * g.depth;
      if (!isClear(x, z)) continue;
      tufts.push({
        x,
        z,
        s: 0.7 + rand01(seed + 0.25) * 0.7,
        rot: rand01(seed + 0.75) * Math.PI,
        shade: rand01(seed + 0.33),
      });
    }
  });
  return tufts;
})();

// 흙길 위 자갈
const PEBBLES: TuftData[] = (() => {
  const pebbles: TuftData[] = [];
  DIRT_PATCHES.forEach((d, di) => {
    const count = 3 + (di % 3);
    for (let i = 0; i < count; i++) {
      const seed = di * 500 + i + 77;
      const a = rand01(seed) * Math.PI * 2;
      const r = rand01(seed + 0.4) * d.radius * 0.8;
      pebbles.push({
        x: d.x + Math.cos(a) * r,
        z: d.z + Math.sin(a) * r,
        s: 0.5 + rand01(seed + 0.2) * 0.8,
        rot: rand01(seed + 0.6) * Math.PI,
        shade: rand01(seed + 0.8),
      });
    }
  });
  return pebbles;
})();

// ---------- 나무 아키타입 분류 ----------
const PINES = TREES.filter((t) => (t.variant ?? "pine") === "pine");

const ROUND_TREES = TREES.filter((t) => t.variant === "round");

const CHERRY_TREES = TREES.filter((t) => t.variant === "cherry");

const TUFT_COLORS = ["#79b859", "#8bcb66", "#9ad973"];

export const PINE_RECORDS = {
  trunk: PINES.map((t, i) => {
    const v = treeVariation(i, PINE_SEED);
    return staticInstance({
      position: [t.x, 1.2, t.z],
      scale: [t.scale * v.wide, t.scale, t.scale * v.deep],
      rotation: [0, v.spin, 0],
    });
  }),
  leaf1: PINES.map((t, i) => {
    const v = treeVariation(i, PINE_SEED);
    return staticInstance({
      position: [t.x, 3.2 * t.scale, t.z],
      scale: [t.scale * v.wide, t.scale, t.scale * v.deep],
      rotation: [0, v.spin, 0],
    });
  }),
  leaf2: PINES.map((t, i) => {
    const v = treeVariation(i, PINE_SEED);
    return staticInstance({
      position: [t.x, 4.7 * t.scale, t.z],
      scale: [t.scale * v.wide, t.scale, t.scale * v.deep],
      rotation: [0, v.spin + 0.4, 0],
    });
  }),
  leaf3: PINES.map((t, i) => {
    const v = treeVariation(i, PINE_SEED);
    return staticInstance({
      position: [t.x, 6 * t.scale, t.z],
      scale: [t.scale * v.wide, t.scale, t.scale * v.deep],
      rotation: [0, v.spin + 0.8, 0],
    });
  }),
};

export const ROUND_TREE_RECORDS = {
  trunk: ROUND_TREES.map((t, i) => {
    const v = treeVariation(i, ROUND_SEED);
    return staticInstance({
      position: [t.x, 1.3 * t.scale, t.z],
      scale: [t.scale * v.wide, t.scale, t.scale * v.deep],
      rotation: [0, v.spin, 0],
    });
  }),
  crown: ROUND_TREES.map((t, i) => {
    const v = treeVariation(i, ROUND_SEED);
    return staticInstance({
      position: [t.x, 3.4 * t.scale, t.z],
      scale: [t.scale * v.wide, t.scale * v.tall, t.scale * v.deep],
      rotation: [v.tiltX, v.spin, v.tiltZ],
    });
  }),
  sides: ROUND_TREES.flatMap((t, i) => {
    const v = treeVariation(i, ROUND_SEED);
    return [
      staticInstance({
        position: [
          t.x + Math.cos(v.spin) * 0.95 * t.scale,
          2.8 * t.scale,
          t.z + Math.sin(v.spin) * 0.95 * t.scale,
        ],
        scale: [t.scale * v.wide, t.scale * v.tall, t.scale * v.deep],
        rotation: [v.tiltX, v.spin + 2.1, 0.2 + v.tiltZ],
      }),
      staticInstance({
        position: [
          t.x - Math.cos(v.spin + 0.9) * 0.9 * t.scale,
          3 * t.scale,
          t.z - Math.sin(v.spin + 0.9) * 0.9 * t.scale,
        ],
        scale: [
          t.scale * 0.9 * v.wide,
          t.scale * 0.9 * v.tall,
          t.scale * 0.9 * v.deep,
        ],
        rotation: [0.15 + v.tiltX, v.spin + 4.4, v.tiltZ],
      }),
    ];
  }),
};

export const CHERRY_TREE_RECORDS = {
  trunk: CHERRY_TREES.map((t, i) => {
    const v = treeVariation(i, CHERRY_SEED);
    return staticInstance({
      position: [t.x, 1.3 * t.scale, t.z],
      scale: [t.scale * v.wide, t.scale, t.scale * v.deep],
      rotation: [0, v.spin, 0],
    });
  }),
  crown: CHERRY_TREES.map((t, i) => {
    const v = treeVariation(i, CHERRY_SEED);
    return staticInstance({
      position: [t.x, 3.3 * t.scale, t.z],
      scale: [
        t.scale * 0.95 * v.wide,
        t.scale * 0.95 * v.tall,
        t.scale * 0.95 * v.deep,
      ],
      rotation: [v.tiltX, v.spin, v.tiltZ],
    });
  }),
  side: CHERRY_TREES.map((t, i) => {
    const v = treeVariation(i, CHERRY_SEED);
    return staticInstance({
      position: [
        t.x + Math.cos(v.spin) * 0.85 * t.scale,
        2.75 * t.scale,
        t.z + Math.sin(v.spin) * 0.85 * t.scale,
      ],
      scale: [
        t.scale * 0.85 * v.wide,
        t.scale * 0.85 * v.tall,
        t.scale * 0.85 * v.deep,
      ],
      rotation: [v.tiltX, v.spin + 2.6, 0.1 + v.tiltZ],
    });
  }),
};

export const GRASS_TUFT_RECORDS = GRASS_TUFTS.map((t) =>
  staticInstance({
    position: [t.x, 0, t.z],
    scale: [t.s, t.s * 1.1, t.s],
    rotation: [0, t.rot, 0],
    color: TUFT_COLORS[Math.floor(t.shade * TUFT_COLORS.length)],
  }),
);

export const PEBBLE_RECORDS = PEBBLES.map((p) =>
  staticInstance({
    position: [p.x, 0.05 * p.s, p.z],
    scale: [p.s, p.s * 0.6, p.s],
    rotation: [0, p.rot, 0],
  }),
);

export const FLOWER_RECORDS = {
  stem: FLOWERS.map((f) =>
    staticInstance({ position: [f.pos[0], 0.15, f.pos[2]] }),
  ),
  head: FLOWERS.map((f, i) =>
    staticInstance({
      position: [f.pos[0], 0.35, f.pos[2]],
      rotation: [0, i * 1.31, 0],
      color: f.color,
    }),
  ),
  core: FLOWERS.map((f) =>
    staticInstance({ position: [f.pos[0], 0.37, f.pos[2]] }),
  ),
};

export const FENCE_POST_RECORDS = FENCES.flatMap((f) => [
  ...f.lines.south.flatMap((x) => [
    staticInstance({ position: [x - 1, 0.9, f.dist] }),
    staticInstance({ position: [x + 1, 0.9, f.dist] }),
  ]),
  ...f.lines.north.flatMap((x) => [
    staticInstance({ position: [x - 1, 0.9, -f.dist] }),
    staticInstance({ position: [x + 1, 0.9, -f.dist] }),
  ]),
  ...f.lines.west.flatMap((z) => [
    staticInstance({ position: [-f.dist, 0.9, z - 1] }),
    staticInstance({ position: [-f.dist, 0.9, z + 1] }),
  ]),
  ...f.lines.east.flatMap((z) => [
    staticInstance({ position: [f.dist, 0.9, z - 1] }),
    staticInstance({ position: [f.dist, 0.9, z + 1] }),
  ]),
]);

export const FENCE_RAIL_RECORDS = FENCES.flatMap((f) => [
  ...f.lines.south.flatMap((x) => [
    staticInstance({ position: [x, 1.4, f.dist] }),
    staticInstance({ position: [x, 0.6, f.dist] }),
  ]),
  ...f.lines.north.flatMap((x) => [
    staticInstance({ position: [x, 1.4, -f.dist] }),
    staticInstance({ position: [x, 0.6, -f.dist] }),
  ]),
  ...f.lines.west.flatMap((z) => [
    staticInstance({
      position: [-f.dist, 1.4, z],
      rotation: [0, Math.PI / 2, 0],
    }),
    staticInstance({
      position: [-f.dist, 0.6, z],
      rotation: [0, Math.PI / 2, 0],
    }),
  ]),
  ...f.lines.east.flatMap((z) => [
    staticInstance({
      position: [f.dist, 1.4, z],
      rotation: [0, Math.PI / 2, 0],
    }),
    staticInstance({
      position: [f.dist, 0.6, z],
      rotation: [0, Math.PI / 2, 0],
    }),
  ]),
]);
