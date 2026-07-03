import {
  COLLISION_TREES,
  COLLISION_ROCKS,
  COLLISION_HOUSES,
  COLLISION_BENCHES,
  COLLISION_PONDS,
  COLLISION_LANTERNS,
  COLLISION_FENCES,
  WORLD_BOUNDS,
} from "@/constants/world";

const FENCE_THICKNESS = 0.4;

// 충돌 체크 함수 (y값을 추가하여 점프 시 통과 여부 결정)
export const checkCollision = (x: number, z: number, y: number = 0) => {
  // 1. 월드 경계 체크
  if (
    x < WORLD_BOUNDS.min ||
    x > WORLD_BOUNDS.max ||
    z < WORLD_BOUNDS.min ||
    z > WORLD_BOUNDS.max
  )
    return true;

  // 2. 나무·중앙 고목 충돌 (항상 충돌, 점프로 못 넘음)
  for (const tree of COLLISION_TREES) {
    const dx = x - tree.x;
    const dz = z - tree.z;
    if (dx * dx + dz * dz < tree.radius * tree.radius) return true;
  }

  // 3. 바위 충돌 (낮은 바위는 점프 중 y > 1.0이면 통과 가능)
  if (y < 1.0) {
    for (const rock of COLLISION_ROCKS) {
      const dx = x - rock.x;
      const dz = z - rock.z;
      if (dx * dx + dz * dz < rock.radius * rock.radius) return true;
    }
  }

  // 4. 집 충돌 (항상 충돌, 점프로 못 넘음)
  for (const house of COLLISION_HOUSES) {
    if (x > house.minX && x < house.maxX && z > house.minZ && z < house.maxZ)
      return true;
  }

  // 5. 울타리 충돌 (점프 중 y > 1.3이면 통과 가능)
  if (y < 1.3) {
    for (const fence of COLLISION_FENCES) {
      const main = fence.axis === "z" ? z : x;
      const cross = fence.axis === "z" ? x : z;
      if (
        Math.abs(main - fence.at) < FENCE_THICKNESS &&
        cross > fence.from &&
        cross < fence.to
      )
        return true;
    }
  }

  // 6. 벤치 충돌 (낮은 벤치는 점프 중 y > 0.8이면 통과 가능)
  if (y < 0.8) {
    for (const bench of COLLISION_BENCHES) {
      if (x > bench.minX && x < bench.maxX && z > bench.minZ && z < bench.maxZ)
        return true;
    }
  }

  // 7. 연못 충돌 (항상 충돌, 점프로 못 넘음)
  for (const pond of COLLISION_PONDS) {
    const dx = x - pond.x;
    const dz = z - pond.z;
    if (dx * dx + dz * dz < pond.radius * pond.radius) return true;
  }

  // 8. 석등·표지판 충돌 (항상 충돌)
  for (const lantern of COLLISION_LANTERNS) {
    const dx = x - lantern.x;
    const dz = z - lantern.z;
    if (dx * dx + dz * dz < lantern.radius * lantern.radius) return true;
  }

  return false;
};
