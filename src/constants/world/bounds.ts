/**
 * 월드 경계.
 *
 * 존 파일과 index가 함께 참조하므로(경계 숲은 이 값에서 파생되고, index는
 * 충돌·미니맵에 그대로 넘긴다) 순환 참조를 피하려고 별도 모듈에 둔다.
 *
 * 존 배치의 실제 범위는 x [-50, 50], z [-17.5, 50]이다. 여기에 걸어 나갈
 * 여유(APRON)를 붙인 직사각형이 걷기 한계다.
 *
 * 이전에는 ±74 정사각형이었는데, 콘텐츠가 남쪽으로 치우쳐 있어 북쪽에만
 * 57 유닛짜리 빈 잔디가 남았다. 아무것도 없는 곳까지 걸어갈 수 있으면
 * 월드가 넓게 느껴지는 게 아니라 비어 보인다.
 */

/** 존 경계 바깥으로 더 걸어 나갈 수 있는 여유 */
const APRON = 12;

export const WORLD_BOUNDS = {
  minX: -50 - APRON,
  maxX: 50 + APRON,
  minZ: -17.5 - APRON - 0.5,
  maxZ: 50 + APRON,
};

export const WORLD_SIZE = {
  width: WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX,
  depth: WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ,
  centerX: (WORLD_BOUNDS.minX + WORLD_BOUNDS.maxX) / 2,
  centerZ: (WORLD_BOUNDS.minZ + WORLD_BOUNDS.maxZ) / 2,
};
