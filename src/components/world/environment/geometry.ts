import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";

// ---------- 식생 실루엣 ----------
// 대나무 잎과 꽃은 콘·구체 프리미티브라 가까이서 보면 도형으로 읽혔다.
// 형태를 가진 평면으로 바꾼다. 둘 다 인스턴싱 대상이므로 지오메트리는
// 모듈에서 한 번만 만들고, 축(+Y)은 기존과 같게 유지해 인스턴스 변환을
// 그대로 쓴다.

/** 끝이 뾰족한 댓잎 (XY 평면, +Y 방향) */
export const createBambooLeafGeometry = () => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.17, 0.4, 0.02, 1.15);
  s.quadraticCurveTo(-0.13, 0.42, 0, 0);
  return new THREE.ShapeGeometry(s, 8);
};

/** 잎 3장이 뭉친 풀포기 (콘 하나보다 훨씬 풀처럼 읽힌다) */
export const createGrassTuftGeometry = () => {
  const blade = () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(0.1, 0.32, 0.015, 0.66);
    s.quadraticCurveTo(-0.075, 0.34, 0, 0);
    return new THREE.ShapeGeometry(s, 5);
  };

  // 방위와 기울기를 달리한 잎 3장을 한 지오메트리로 합쳐 인스턴스 1개로 쓴다
  const parts = [
    { spin: 0, lean: 0.16 },
    { spin: 1.15, lean: -0.22 },
    { spin: 2.45, lean: 0.06 },
  ].map(({ spin, lean }) => {
    const g = blade();
    g.rotateZ(lean);
    g.rotateY(spin);
    return g;
  });

  return mergeBufferGeometries(parts, false)!;
};

/** 모서리를 흐트러뜨린 바위 — 정다면체 티를 없앤다 */
export const createRockGeometry = () => {
  const geom = new THREE.DodecahedronGeometry(0.5, 1);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // 좌표 기반 결정적 흔들림 — 같은 정점은 같은 값이라 면이 갈라지지 않는다
    const n = Math.sin(x * 12.9 + y * 78.2 + z * 37.7) * 43758.5453;
    const jitter = 1 + ((n - Math.floor(n)) - 0.5) * 0.34;
    pos.setXYZ(i, x * jitter, y * jitter, z * jitter);
  }
  geom.computeVertexNormals();
  return geom;
};

/** 5장 꽃잎 (XZ 평면에 눕혀 위에서 내려다보게) */
export const createFlowerHeadGeometry = () => {
  const PETALS = 5;
  const TIP = 0.17; // 꽃잎 끝
  const WAIST = 0.055; // 꽃잎 사이 잘록한 지점
  const at = (radius: number, angle: number) =>
    [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;

  const s = new THREE.Shape();
  const [sx, sy] = at(WAIST, 0);
  s.moveTo(sx, sy);

  for (let i = 0; i < PETALS; i++) {
    const a0 = (i / PETALS) * Math.PI * 2;
    const mid = ((i + 0.5) / PETALS) * Math.PI * 2;
    const a1 = ((i + 1) / PETALS) * Math.PI * 2;
    const [c1x, c1y] = at(TIP * 1.15, a0 + (mid - a0) * 0.4);
    const [mx, my] = at(TIP, mid);
    const [c2x, c2y] = at(TIP * 1.15, mid + (a1 - mid) * 0.6);
    const [ex, ey] = at(WAIST, a1);
    s.quadraticCurveTo(c1x, c1y, mx, my);
    s.quadraticCurveTo(c2x, c2y, ex, ey);
  }

  const geom = new THREE.ShapeGeometry(s, 6);
  geom.rotateX(-Math.PI / 2);
  return geom;
};
