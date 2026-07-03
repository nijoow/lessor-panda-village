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
export const WORLD_BOUNDS = {
  min: -80,
  max: 80,
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
export const FENCES = ZONES.flatMap((z) => z.fences ?? []);
export const SIGNS = ZONES.flatMap((z) => z.signs ?? []);
export const BAMBOO = ZONES.flatMap((z) => z.bamboo ?? []);
export const BRIDGES = ZONES.flatMap((z) => z.bridges ?? []);
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
// 석등·표지판·대나무는 동일한 "항상 충돌" 기둥이므로 하나로 합쳐 판정
export const COLLISION_LANTERNS: CollisionCircle[] = [
  ...LANTERNS,
  ...SIGNS,
  ...BAMBOO,
];
export const COLLISION_BENCHES: CollisionBox[] = BENCHES.map(benchBox);
export const COLLISION_PONDS: CollisionCircle[] = PONDS;
export const COLLISION_HOUSES: CollisionBox[] = HOUSES.map((h) => h.box);
export const COLLISION_FENCES: FenceSegment[] = FENCES.flatMap(fenceSegments);
