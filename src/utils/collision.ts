import {
  COLLISION_TREES,
  COLLISION_ROCKS,
  COLLISION_HOUSES,
  COLLISION_BOARDS,
  COLLISION_BENCHES,
  COLLISION_PONDS,
  COLLISION_LANTERNS,
  COLLISION_FENCES,
  BAMBOO,
  WORLD_BOUNDS,
} from "@/constants/world";
import { useHarvestStore } from "@/stores/harvestStore";

/**
 * 공간 해시 그리드 기반 충돌 판정.
 *
 * 월드의 충돌 도형(~300개)을 모듈 로드 시 한 번 셀 그리드에 인덱싱하고,
 * checkCollision은 해당 셀의 도형만 검사한다. A* 길찾기가 클릭 한 번에
 * 수만 번 호출하므로 선형 스캔(도형 전수 순회)은 프레임 히치를 만든다.
 *
 * 도형별 통과 규칙은 maxY로 표현: 점프 높이 y가 maxY 이상이면 통과.
 * (기존 동작과 동일 — 나무·물·석등·집은 통과 불가, 바위 1.0,
 * 울타리 1.3, 벤치 0.8)
 */

const CELL = 4; // 셀 한 변 (월드 유닛)
const FENCE_THICKNESS = 0.4;

type Shape =
  | { kind: "circle"; x: number; z: number; r2: number; maxY: number }
  // 수확으로 일시 제거되는 대나무 (idx로 harvestedSet 조회)
  | { kind: "bamboo"; x: number; z: number; r2: number; idx: number }
  | {
      kind: "box";
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
      maxY: number;
    }
  | {
      kind: "fence";
      axis: "x" | "z";
      at: number;
      from: number;
      to: number;
      maxY: number;
    };

const grid = new Map<number, Shape[]>();

const cellOf = (v: number) => Math.floor(v / CELL);
// 월드 ±80 기준 충분히 큰 오프셋으로 음수 좌표를 양수 키로 변환
const keyOf = (cx: number, cz: number) => (cx + 128) * 4096 + (cz + 128);

const insert = (
  shape: Shape,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
) => {
  for (let cx = cellOf(minX); cx <= cellOf(maxX); cx++) {
    for (let cz = cellOf(minZ); cz <= cellOf(maxZ); cz++) {
      const key = keyOf(cx, cz);
      const list = grid.get(key);
      if (list) list.push(shape);
      else grid.set(key, [shape]);
    }
  }
};

const insertCircle = (
  c: { x: number; z: number; radius: number },
  maxY: number,
) => {
  insert(
    { kind: "circle", x: c.x, z: c.z, r2: c.radius * c.radius, maxY },
    c.x - c.radius,
    c.x + c.radius,
    c.z - c.radius,
    c.z + c.radius,
  );
};

// ---------- 그리드 구축 (모듈 로드 시 1회) ----------
for (const t of COLLISION_TREES) insertCircle(t, Infinity);
for (const l of COLLISION_LANTERNS) insertCircle(l, Infinity); // 석등·표지판
for (const p of COLLISION_PONDS) insertCircle(p, Infinity); // 연못·강
BAMBOO.forEach((b, idx) => {
  insert(
    { kind: "bamboo", x: b.x, z: b.z, r2: b.radius * b.radius, idx },
    b.x - b.radius,
    b.x + b.radius,
    b.z - b.radius,
    b.z + b.radius,
  );
});
for (const r of COLLISION_ROCKS) insertCircle(r, 1.0);
for (const h of COLLISION_HOUSES) {
  insert(
    { kind: "box", ...h, maxY: Infinity },
    h.minX,
    h.maxX,
    h.minZ,
    h.maxZ,
  );
}
for (const b of COLLISION_BOARDS) {
  insert(
    { kind: "box", ...b, maxY: Infinity },
    b.minX,
    b.maxX,
    b.minZ,
    b.maxZ,
  );
}
for (const b of COLLISION_BENCHES) {
  insert({ kind: "box", ...b, maxY: 0.8 }, b.minX, b.maxX, b.minZ, b.maxZ);
}
for (const f of COLLISION_FENCES) {
  const shape: Shape = { kind: "fence", ...f, maxY: 1.3 };
  if (f.axis === "z") {
    insert(shape, f.from, f.to, f.at - FENCE_THICKNESS, f.at + FENCE_THICKNESS);
  } else {
    insert(shape, f.at - FENCE_THICKNESS, f.at + FENCE_THICKNESS, f.from, f.to);
  }
}

// 충돌 체크 함수 (y값을 추가하여 점프 시 통과 여부 결정)
export const checkCollision = (x: number, z: number, y: number = 0) => {
  // 월드 경계
  if (
    x < WORLD_BOUNDS.minX ||
    x > WORLD_BOUNDS.maxX ||
    z < WORLD_BOUNDS.minZ ||
    z > WORLD_BOUNDS.maxZ
  )
    return true;

  const shapes = grid.get(keyOf(cellOf(x), cellOf(z)));
  if (!shapes) return false;

  const harvested = useHarvestStore.getState().harvestedSet;
  for (const s of shapes) {
    if (s.kind === "bamboo") {
      if (harvested.has(s.idx)) continue;
      const dx = x - s.x;
      const dz = z - s.z;
      if (dx * dx + dz * dz < s.r2) return true;
      continue;
    }
    if (y >= s.maxY) continue;
    if (s.kind === "circle") {
      const dx = x - s.x;
      const dz = z - s.z;
      if (dx * dx + dz * dz < s.r2) return true;
    } else if (s.kind === "box") {
      if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ) return true;
    } else {
      const main = s.axis === "z" ? z : x;
      const cross = s.axis === "z" ? x : z;
      if (
        Math.abs(main - s.at) < FENCE_THICKNESS &&
        cross > s.from &&
        cross < s.to
      )
        return true;
    }
  }
  return false;
};
