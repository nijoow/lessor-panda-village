import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─────────────────────────────────────────────
// 유틸리티 및 상수
// ─────────────────────────────────────────────
const getRandomPos = (spread: number) => (Math.random() - 0.5) * spread;

const PETAL_COUNT = 120;
const PETAL_SPREAD = 28;
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

// 초기 데이터 생성을 위한 함수 (정적 데이터 생성)
const generatePetalDataSync = (): PetalData[] => {
  const temp: PetalData[] = [];
  for (let i = 0; i < PETAL_COUNT; i++) {
    temp.push({
      position: new THREE.Vector3(
        getRandomPos(PETAL_SPREAD),
        Math.random() * 10 + 2,
        getRandomPos(PETAL_SPREAD),
      ),
      velocity: new THREE.Vector3(
        getRandomPos(0.04),
        -(Math.random() * 0.015 + 0.005),
        getRandomPos(0.04),
      ),
      phase: Math.random() * Math.PI * 2,
      rotationSpeed: getRandomPos(0.1),
      rotation: Math.random() * Math.PI * 2,
      colorIndex: Math.floor(Math.random() * PETAL_COLORS.length),
    });
  }
  return temp;
};

// ─────────────────────────────────────────────
// 꽃잎 파티클 (낮)
// ─────────────────────────────────────────────
export const PetalParticles = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  
  // 렌더링 시점에 Math.random()을 호출하지 않기 위해 
  // 초기 데이터를 lazy하게 생성하거나 정적으로 관리
  const [particles] = useState(() => generatePetalDataSync());
  
  // 리셋 시 사용할 랜덤 값들도 초기 1회만 생성
  const randomOffsets = useMemo(() => {
    const arr = new Float32Array(PETAL_COUNT);
    for (let i = 0; i < PETAL_COUNT; i++) arr[i] = Math.random();
    return arr;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;

    particles.forEach((p, i) => {
      p.position.x += p.velocity.x + Math.sin(t * 0.5 + p.phase) * 0.008;
      p.position.y += p.velocity.y;
      p.position.z += p.velocity.z + Math.cos(t * 0.3 + p.phase) * 0.008;
      p.rotation += p.rotationSpeed;

      if (p.position.y < 0) {
        const off = randomOffsets[i];
        p.position.y = 10 + off * 4;
        p.position.x = (off - 0.5) * PETAL_SPREAD;
        p.position.z = (((off * 1.7) % 1) - 0.5) * PETAL_SPREAD;
      }

      dummy.position.copy(p.position);
      dummy.rotation.set(p.rotation, p.rotation * 0.7, p.rotation * 0.5);
      dummy.scale.setScalar(0.06 + Math.sin(t + p.phase) * 0.01);
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
      <planeGeometry args={[1, 0.6]} />
      <meshStandardMaterial
        side={THREE.DoubleSide}
        transparent
        opacity={0.82}
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
  const [fireflies] = useState(() => generateFireflyDataSync());

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;

    fireflies.forEach((f, i) => {
      const x = f.position.x + Math.sin(t * f.speed + f.phase) * f.radius;
      const y = f.position.y + Math.sin(t * f.speed * 1.3 + f.phase) * 0.4;
      const z = f.position.z + Math.cos(t * f.speed + f.phase) * f.radius;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(0.02 + Math.abs(Math.sin(t * 3 + f.phase)) * 0.04);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const br = 0.4 + Math.abs(Math.sin(t * 3 + f.phase)) * 0.6;
      color.setHSL(0.13 + Math.sin(f.phase) * 0.02, 1.0, br * 0.8);
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
        emissive="#ffff88"
        emissiveIntensity={3}
        transparent
        opacity={0.9}
        roughness={0}
      />
    </instancedMesh>
  );
};
