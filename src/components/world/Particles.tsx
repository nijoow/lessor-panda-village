import { useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─────────────────────────────────────────────
// 유틸리티 및 상수
// ─────────────────────────────────────────────
const getRandomPos = (spread: number) => (Math.random() - 0.5) * spread;

const PETAL_COUNT = 240;
const PETAL_SPREAD = 28;
const TREE_CENTER = { x: -6, z: 5 };
const CONCENTRATION_RADIUS = 7;
const PETAL_COLORS = [
  new THREE.Color("#ffb3c6"),
  new THREE.Color("#ffd6e7"),
  new THREE.Color("#ffcba4"),
  new THREE.Color("#fff0b3"),
  new THREE.Color("#e8b4f8"),
];

interface PetalData {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  phase: number;
  rotationSpeed: number;
  rotation: number;
  colorIndex: number;
}

interface FireflyData {
  position: THREE.Vector3;
  phase: number;
  speed: number;
  radius: number;
}

interface ParticleInitData {
  particles: PetalData[];
  randomOffsets: Float32Array;
}

const generateInitialPetalData = (): ParticleInitData => {
  const particles: PetalData[] = [];
  const randomOffsets = new Float32Array(PETAL_COUNT);

  for (let i = 0; i < PETAL_COUNT; i++) {
    const isConcentrated = Math.random() < 0.75;
    let x, z;

    if (isConcentrated) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * CONCENTRATION_RADIUS;
      x = TREE_CENTER.x + Math.cos(angle) * r;
      z = TREE_CENTER.z + Math.sin(angle) * r;
    } else {
      x = getRandomPos(PETAL_SPREAD);
      z = getRandomPos(PETAL_SPREAD);
    }

    particles.push({
      position: new THREE.Vector3(x, Math.random() * 8 + 1, z),
      velocity: new THREE.Vector3(
        getRandomPos(0.03),
        -(Math.random() * 0.012 + 0.006),
        getRandomPos(0.03),
      ),
      phase: Math.random() * Math.PI * 2,
      rotationSpeed: getRandomPos(0.08),
      rotation: Math.random() * Math.PI * 2,
      colorIndex: Math.floor(Math.random() * PETAL_COLORS.length),
    });
    randomOffsets[i] = Math.random();
  }
  return { particles, randomOffsets };
};

// ─────────────────────────────────────────────
// 하트 모양 꽃잎 지형 생성 함수
// ─────────────────────────────────────────────
const createHeartShape = () => {
  const shape = new THREE.Shape();
  const x = 0,
    y = 0;
  shape.moveTo(x, y + 0.3);
  shape.bezierCurveTo(x, y + 0.3, x - 0.3, y + 0.5, x - 0.5, y);
  shape.bezierCurveTo(x - 0.5, y - 0.5, x, y - 0.7, x, y - 0.7);
  shape.bezierCurveTo(x, y - 0.7, x + 0.5, y - 0.5, x + 0.5, y);
  shape.bezierCurveTo(x + 0.5, y + 0.5, x, y + 0.3, x, y + 0.3);
  return shape;
};

// ─────────────────────────────────────────────
// 꽃잎 파티클 (낮)
// ─────────────────────────────────────────────
export const PetalParticles = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!);

  const [{ particles }] = useState(() => generateInitialPetalData());
  const heartShape = useMemo(() => createHeartShape(), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return;
    const t = state.clock.elapsedTime;

    const cycleTime = 60;
    const cycleT = (t % cycleTime) / cycleTime;
    const angle = Math.PI - cycleT * 2 * Math.PI;
    const sunAltitude = Math.sin(angle);

    const opacity = THREE.MathUtils.clamp((sunAltitude + 0.2) * 2.5, 0, 0.85);
    materialRef.current.opacity = opacity;

    if (opacity <= 0) return;

    particles.forEach((p, i) => {
      // 펄럭이는 움직임 추가 (Fluttering)
      const flutter = Math.sin(t * 2 + p.phase) * 0.015;
      p.position.x += p.velocity.x + flutter;
      p.position.y += p.velocity.y;
      p.position.z += p.velocity.z + Math.cos(t * 1.5 + p.phase) * 0.015;

      // 회전 속도에 펄럭임 반영
      p.rotation += p.rotationSpeed + Math.sin(t * 3) * 0.01;

      if (p.position.y < -0.5) {
        const isConcentrated = Math.random() < 0.75;
        if (isConcentrated) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * CONCENTRATION_RADIUS;
          p.position.x = TREE_CENTER.x + Math.cos(angle) * r;
          p.position.z = TREE_CENTER.z + Math.sin(angle) * r;
        } else {
          p.position.x = getRandomPos(PETAL_SPREAD);
          p.position.z = getRandomPos(PETAL_SPREAD);
        }
        p.position.y = 8 + Math.random() * 4;
      }

      dummy.position.copy(p.position);
      // 입체적인 회전
      dummy.rotation.set(
        p.rotation + Math.sin(t + p.phase) * 0.5,
        p.rotation * 0.7,
        p.rotation * 0.5 + Math.cos(t * 0.8) * 0.3,
      );
      dummy.scale.setScalar(0.08 + Math.sin(t * 0.5 + p.phase) * 0.02);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      color.copy(PETAL_COLORS[p.colorIndex]);
      meshRef.current.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor)
      meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PETAL_COUNT]}>
      <shapeGeometry args={[heartShape]} />
      <meshStandardMaterial
        ref={materialRef}
        side={THREE.DoubleSide}
        transparent
        opacity={0.85}
        roughness={0.4}
      />
    </instancedMesh>
  );
};

// ─────────────────────────────────────────────
// 반딧불이 파티클 (밤)
// ─────────────────────────────────────────────
const FIREFLY_COUNT = 30;

const generateFireflyDataSync = (): FireflyData[] => {
  const temp: FireflyData[] = [];
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    temp.push({
      position: new THREE.Vector3(
        getRandomPos(24),
        Math.random() * 5 + 0.5,
        getRandomPos(24),
      ),
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.4,
      radius: 0.1 + Math.random() * 0.8,
    });
  }
  return temp;
};

export const FireflyParticles = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!);
  const [fireflies] = useState(() => generateFireflyDataSync());

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return;
    const t = state.clock.elapsedTime;

    // 밤에만 은은하게 나타남
    const cycleTime = 60;
    const cycleT = (t % cycleTime) / cycleTime;
    const angle = Math.PI - cycleT * 2 * Math.PI;
    const sunAltitude = Math.sin(angle);

    // 해가 지평선 아래로 내려갈 때(sunAltitude < 0) 불투명도 증가
    const opacity = THREE.MathUtils.clamp(-sunAltitude * 3.0, 0, 1.0);
    materialRef.current.opacity = opacity;
    materialRef.current.emissiveIntensity = opacity * 6;

    if (opacity <= 0) return;

    fireflies.forEach((f, i) => {
      const x = f.position.x + Math.sin(t * f.speed + f.phase) * f.radius;
      const y = f.position.y + Math.sin(t * f.speed * 1.3 + f.phase) * 0.4;
      const z = f.position.z + Math.cos(t * f.speed + f.phase) * f.radius;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(0.02 + Math.abs(Math.sin(t * 3 + f.phase)) * 0.04);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const br = 0.5 + Math.abs(Math.sin(t * 3 + f.phase)) * 0.5;
      // 완전한 진한 노랑/주황 계열로 색상 반경 좁힘 (0.08-0.12 HSL)
      color.setHSL(0.09 + Math.sin(f.phase) * 0.01, 1.0, br * 0.7);
      meshRef.current.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor)
      meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, FIREFLY_COUNT]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        ref={materialRef}
        emissive="#ffa500"
        emissiveIntensity={12}
        transparent
        opacity={0.9}
        roughness={0}
      />
    </instancedMesh>
  );
};
