/**
 * 월드 구성의 단일 소스(Single Source of Truth).
 *
 * 존 파일들을 ZONES로 등록하면 비주얼 배치 배열과 충돌 판정 데이터가
 * 모두 여기서 자동 집계됩니다. 새 존 추가 = 존 파일 작성 + ZONES 등록.
 */
import {
  BenchPlacement,
  CollisionBox,
  CollisionCircle,
  FenceLayout,
  ZoneLayout,
} from "./types";
import { VILLAGE } from "./village";
import { SOUTH_FIELD } from "./southField";
import { BAMBOO_GROVE } from "./bambooGrove";
import { RIVERSIDE } from "./riverside";
import { WILDS } from "./wilds";

export * from "./types";
export { VILLAGE, SOUTH_FIELD, BAMBOO_GROVE, RIVERSIDE, WILDS };

export const ZONES: ZoneLayout[] = [
  VILLAGE,
  SOUTH_FIELD,
  BAMBOO_GROVE,
  RIVERSIDE,
  WILDS,
];

// ---------- 월드 경계 ----------
// 경계 숲(wilds)이 ±88까지 이어지므로, 걷기 한계를 그보다 안쪽에 둔다.
// 멈춰 선 지점에서도 나무가 계속 보여 "숲이 깊어 더 못 간다"로 읽힌다.
export const WORLD_BOUNDS = {
  min: -74,
  max: 74,
};

/** 현재 좌표가 속한 존 (bounds 있는 존만 대상, 없으면 null) */
export const zoneAt = (x: number, z: number): ZoneLayout | null => {
  for (const zone of ZONES) {
    const b = zone.bounds;
    if (!b) continue;
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return zone;
  }
  return null;
};

// ---------- 비주얼 배치 집계 (Environment/World/Ground/Player에서 사용) ----------
export const TREES = ZONES.flatMap((z) => z.trees ?? []);
export const ROCKS = ZONES.flatMap((z) => z.rocks ?? []);
export const LANTERNS = ZONES.flatMap((z) => z.lanterns ?? []);
export const BENCHES = ZONES.flatMap((z) => z.benches ?? []);
export const FLOWERS = ZONES.flatMap((z) => z.flowers ?? []);
export const PONDS = ZONES.flatMap((z) => z.ponds ?? []);
export const LANDMARK_TREES = ZONES.flatMap((z) => z.landmarkTrees ?? []);
export const HOUSES = ZONES.flatMap((z) => z.houses ?? []);
export const NOTICE_BOARDS = ZONES.flatMap((z) => z.noticeBoards ?? []);
export const FENCES = ZONES.flatMap((z) => z.fences ?? []);
export const SIGNS = ZONES.flatMap((z) => z.signs ?? []);
export const BAMBOO = ZONES.flatMap((z) => z.bamboo ?? []);
export const BRIDGES = ZONES.flatMap((z) => z.bridges ?? []);
export const RIVERS = ZONES.flatMap((z) => z.rivers ?? []);
export const GRASS_PATCHES = ZONES.flatMap((z) => z.grassPatches ?? []);
export const DIRT_PATCHES = ZONES.flatMap((z) => z.dirtPatches ?? []);
export const STONE_PATHS = ZONES.flatMap((z) => z.stonePaths ?? []);

// ---------- 충돌 판정용 파생 데이터 (collision.ts에서 사용) ----------
// 좌석 2.2 x 0.8 크기 기준, ±90° 회전 시 긴 축이 z 방향
const benchBox = ({ x, z, rotation }: BenchPlacement): CollisionBox => {
  const halfW = 1.1;
  const halfD = 0.4;
  const rotated = Math.abs(Math.abs(rotation) - Math.PI / 2) < 0.01;
  return rotated
    ? { minX: x - halfD, maxX: x + halfD, minZ: z - halfW, maxZ: z + halfW }
    : { minX: x - halfW, maxX: x + halfW, minZ: z - halfD, maxZ: z + halfD };
};

/** 울타리 한 측면의 충돌 스팬. axis는 울타리가 가로막는 좌표축. */
export interface FenceSegment {
  axis: "x" | "z";
  at: number;
  from: number;
  to: number;
}

// 세그먼트 중심(간격 2) ± 기둥 오프셋 1.0 + 여유 0.5 = min-1.5 ~ max+1.5
const fenceSegments = (f: FenceLayout): FenceSegment[] => {
  const span = (line: number[]) =>
    line.length
      ? { from: Math.min(...line) - 1.5, to: Math.max(...line) + 1.5 }
      : null;
  const sides: Array<[number[], "x" | "z", number]> = [
    [f.lines.south, "z", f.dist],
    [f.lines.north, "z", -f.dist],
    [f.lines.west, "x", -f.dist],
    [f.lines.east, "x", f.dist],
  ];
  return sides.flatMap(([line, axis, at]) => {
    const s = span(line);
    return s ? [{ axis, at, ...s }] : [];
  });
};

// 나무·중앙 고목은 동일하게 "항상 충돌" 원기둥이므로 하나로 합쳐 판정
export const COLLISION_TREES: CollisionCircle[] = [
  ...TREES,
  ...LANDMARK_TREES,
];
export const COLLISION_ROCKS: CollisionCircle[] = ROCKS;
// 석등·표지판은 동일한 "항상 충돌" 기둥이므로 하나로 합쳐 판정.
// 대나무는 수확으로 사라질 수 있어 collision.ts에서 인덱스와 함께 별도 처리.
export const COLLISION_LANTERNS: CollisionCircle[] = [...LANTERNS, ...SIGNS];
export const COLLISION_BENCHES: CollisionBox[] = BENCHES.map(benchBox);

// 강 충돌: 중심선을 1.2 간격으로 샘플링한 원 — 다리 발자국 안은 제외
const RIVER_SAMPLE_STEP = 1.2;
const insideBridge = (x: number, z: number) =>
  BRIDGES.some((b) => {
    const cos = Math.cos(-b.rotation);
    const sin = Math.sin(-b.rotation);
    const dx = x - b.x;
    const dz = z - b.z;
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    return (
      Math.abs(lx) < b.length / 2 + 0.4 && Math.abs(lz) < b.width / 2 + 1.2
    );
  });

const riverCircles = (r: (typeof RIVERS)[number]): CollisionCircle[] => {
  const circles: CollisionCircle[] = [];
  for (let i = 0; i < r.points.length - 1; i++) {
    const [x0, z0] = r.points[i];
    const [x1, z1] = r.points[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.ceil(len / RIVER_SAMPLE_STEP));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      if (insideBridge(x, z)) continue;
      circles.push({ x, z, radius: r.width / 2 + 0.2 });
    }
  }
  return circles;
};

export const COLLISION_PONDS: CollisionCircle[] = [
  ...PONDS,
  ...RIVERS.flatMap(riverCircles),
];
export const COLLISION_HOUSES: CollisionBox[] = HOUSES.map((h) => h.box);
export const COLLISION_BOARDS: CollisionBox[] = NOTICE_BOARDS.map((b) => b.box);
export const COLLISION_FENCES: FenceSegment[] = FENCES.flatMap(fenceSegments);
