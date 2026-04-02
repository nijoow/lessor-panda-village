import {
  COLLISION_TREES,
  COLLISION_ROCKS,
  COLLISION_HOUSE,
  WORLD_BOUNDS,
  COLLISION_LANDMARK,
  COLLISION_BENCHES,
  COLLISION_POND,
  COLLISION_LANTERNS,
} from "@/constants/collisionMap";

// 충돌 체크 함수 (y값을 추가하여 점프 시 통과 여부 결정)
export const checkCollision = (x: number, z: number, y: number = 0) => {
  // 1. 월드 경계 체크 (가장 바깥쪽 80x80 잔디 영역)
  if (
    x < WORLD_BOUNDS.min ||
    x > WORLD_BOUNDS.max ||
    z < WORLD_BOUNDS.min ||
    z > WORLD_BOUNDS.max
  )
    return true;

  // 2. 나무 충돌 (항상 충돌, 점프로 못 넘음)
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
  if (
    x > COLLISION_HOUSE.minX &&
    x < COLLISION_HOUSE.maxX &&
    z > COLLISION_HOUSE.minZ &&
    z < COLLISION_HOUSE.maxZ
  ) {
    return true;
  }

  // 5. 울타리 충돌 (x, z = ±17 라인에서 점프 중 y > 1.3이면 통과 가능)
  const FENCE_DIST = 17;
  const FENCE_THICKNESS = 0.4;
  if (y < 1.3) {
    const absX = Math.abs(x);
    const absZ = Math.abs(z);

    // 남/북 울타리 (z축 기준)
    if (
      absZ > FENCE_DIST - FENCE_THICKNESS &&
      absZ < FENCE_DIST + FENCE_THICKNESS
    ) {
      if (z < 0) {
        // 북쪽 (z = -17): 전 구간 (x in [-17.5, 17.5])
        if (x > -17.5 && x < 17.5) return true;
      } else {
        // 남쪽 (z = 17): 설치된 구간만 (x in [-17.5, 9.5])
        if (x > -17.5 && x < 9.5) return true;
      }
    }
    // 동/서 울타리 (x축 기준)
    if (
      absX > FENCE_DIST - FENCE_THICKNESS &&
      absX < FENCE_DIST + FENCE_THICKNESS
    ) {
      // 동/서 울타리는 전 구간 차단
      if (z > -17.5 && z < 17.5) return true;
    }
  }

  // 6. 랜드마크 고목 충돌 (항상 충돌, 점프로 못 넘음)
  const dxL = x - COLLISION_LANDMARK.x;
  const dzL = z - COLLISION_LANDMARK.z;
  if (
    dxL * dxL + dzL * dzL <
    COLLISION_LANDMARK.radius * COLLISION_LANDMARK.radius
  )
    return true;

  // 7. 벤치 충돌 (낮은 벤치는 점프 중 y > 0.8이면 통과 가능)
  if (y < 0.8) {
    for (const bench of COLLISION_BENCHES) {
      if (
        x > bench.minX &&
        x < bench.maxX &&
        z > bench.minZ &&
        z < bench.maxZ
      ) {
        return true;
      }
    }
  }

  // 8. 평온한 연못 충돌 (항상 충돌, 점프로 못 넘음)
  const dxP = x - COLLISION_POND.x;
  const dzP = z - COLLISION_POND.z;
  if (dxP * dxP + dzP * dzP < COLLISION_POND.radius * COLLISION_POND.radius)
    return true;

  // 9. 석등 충돌 (항상 충돌)
  for (const lantern of COLLISION_LANTERNS) {
    const dx = x - lantern.x;
    const dz = z - lantern.z;
    if (dx * dx + dz * dz < lantern.radius * lantern.radius) return true;
  }

  return false;
};
