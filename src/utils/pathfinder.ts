import { checkCollision } from "./collision";

export interface Point {
  x: number;
  z: number;
}

interface Node {
  x: number;
  z: number;
  g: number; // Cost from start
  h: number; // Heuristic cost to end
  f: number; // Total cost (g + h)
  parent: Node | null;
}

const GRID_SIZE = 0.5;
// 확장된 월드(±80)에서 장거리 우회 경로도 찾을 수 있는 상한
const MAX_ITERATIONS = 6000;

const nodeKey = (x: number, z: number) => `${x},${z}`;

/**
 * 두 점 사이에 장애물이 있는지 확인 (경로 단순화용)
 */
export const isPathClear = (start: Point, end: Point): boolean => {
  const dist = Math.sqrt((end.x - start.x) ** 2 + (end.z - start.z) ** 2);
  const steps = Math.ceil(dist / (GRID_SIZE / 2));

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const checkX = start.x + (end.x - start.x) * t;
    const checkZ = start.z + (end.z - start.z) * t;
    if (checkCollision(checkX, checkZ, 0)) {
      return false;
    }
  }
  return true;
};

/**
 * A* 길찾기 알고리즘.
 * 경로를 찾지 못하면 빈 배열을 반환합니다 (호출 측에서 이동하지 않음).
 */
export const findPath = (start: Point, end: Point): Point[] => {
  // 목표지점이 충돌 구역이면 이동 불가
  if (checkCollision(end.x, end.z, 0)) {
    return [];
  }

  // 직선 경로가 뚫려 있으면 바로 반환
  if (isPathClear(start, end)) {
    return [end];
  }

  const openSet: Node[] = [];
  // O(1) 좌표 조회용 보조 인덱스 (openSet과 동기 유지)
  const openMap = new Map<string, Node>();
  const closedSet = new Set<string>();

  const startNode: Node = {
    x: Math.round(start.x / GRID_SIZE) * GRID_SIZE,
    z: Math.round(start.z / GRID_SIZE) * GRID_SIZE,
    g: 0,
    h: Math.sqrt((end.x - start.x) ** 2 + (end.z - start.z) ** 2),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.h;

  openSet.push(startNode);
  openMap.set(nodeKey(startNode.x, startNode.z), startNode);

  let iterations = 0;
  while (openSet.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;

    // F score가 가장 낮은 노드 선택
    let currentIndex = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[currentIndex].f) {
        currentIndex = i;
      }
    }

    const current = openSet[currentIndex];

    // 목표 도달 체크 (목표 격자 근처면 성공)
    const distToEnd = Math.sqrt(
      (current.x - end.x) ** 2 + (current.z - end.z) ** 2,
    );
    if (distToEnd < GRID_SIZE) {
      const path: Point[] = [];
      let temp: Node | null = current;
      while (temp) {
        path.push({ x: temp.x, z: temp.z });
        temp = temp.parent;
      }
      path.reverse();
      path.push(end); // 정확한 최종 목적지 추가

      return simplifyPath(path);
    }

    openSet.splice(currentIndex, 1);
    openMap.delete(nodeKey(current.x, current.z));
    closedSet.add(nodeKey(current.x, current.z));

    // 상하좌우 및 대각선 이웃 확인 (8방향)
    const neighbors = [
      { x: 0, z: 1 }, { x: 0, z: -1 }, { x: 1, z: 0 }, { x: -1, z: 0 },
      { x: 1, z: 1 }, { x: 1, z: -1 }, { x: -1, z: 1 }, { x: -1, z: -1 },
    ];

    for (const move of neighbors) {
      const nx = current.x + move.x * GRID_SIZE;
      const nz = current.z + move.z * GRID_SIZE;
      const key = nodeKey(nx, nz);

      if (closedSet.has(key)) continue;
      if (checkCollision(nx, nz, 0)) continue;

      const gScore = current.g + (move.x !== 0 && move.z !== 0 ? 1.414 : 1);

      const neighborNode = openMap.get(key);

      if (!neighborNode) {
        const newNode: Node = {
          x: nx,
          z: nz,
          g: gScore,
          h: Math.sqrt((nx - end.x) ** 2 + (nz - end.z) ** 2),
          f: 0,
          parent: current,
        };
        newNode.f = newNode.g + newNode.h;
        openSet.push(newNode);
        openMap.set(key, newNode);
      } else if (gScore < neighborNode.g) {
        neighborNode.g = gScore;
        neighborNode.f = neighborNode.g + neighborNode.h;
        neighborNode.parent = current;
      }
    }
  }

  // 경로를 찾지 못했거나 반복 횟수 초과
  return [];
};

/**
 * 경로 단순화 (String Pulling)
 * 직선으로 갈 수 있는 중간 노드들을 제거하여 부드럽게 만듦
 */
const simplifyPath = (path: Point[]): Point[] => {
  if (path.length <= 2) return path;

  const simplified: Point[] = [path[0]];
  let currentBase = path[0];

  for (let i = 2; i < path.length; i++) {
    if (!isPathClear(currentBase, path[i])) {
      simplified.push(path[i - 1]);
      currentBase = path[i - 1];
    }
  }

  simplified.push(path[path.length - 1]);
  return simplified;
};
