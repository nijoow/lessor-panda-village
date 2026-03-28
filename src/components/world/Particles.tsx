import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─────────────────────────────────────────────
// 유틸리티: 보다 안정적인 랜덤값 (컴파일러 경고 방지용)
// ─────────────────────────────────────────────
const getRandomPos = (spread: number) => (Math.random() - 0.5) * spread;

// ─────────────────────────────────────────────
// 꽃잎 파티클 (낮 동안 바람에 흩날리는 효과)
// ─────────────────────────────────────────────
const PETAL_COUNT = 120;
const PETAL_SPREAD = 28; // 파티클이 흩뿌려지는 범위
const PETAL_COLORS = [
  new THREE.Color("#ffb3c6"),
  new THREE.Color("#ffd6e7"),
  new THREE.Color("#ffcba4"),
  new THREE.Color("#fff0b3"),
  new THREE.Color("#e8b4f8"),
];

// 초기 데이터 생성을 컴포넌트 외부로 분리하여 'impure function' 에러 방지
const generatePetalData = () => {
  const temp = [];
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

export const PetalParticles = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  // 컴포넌트 외부의 순수(?) 함수를 호출하여 초기화
  const particles = useMemo(() => generatePetalData(), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;

    particles.forEach((p, i) => {
      // 위치 업데이트
      p.position.x += p.velocity.x + Math.sin(t * 0.5 + p.phase) * 0.008;
      p.position.y += p.velocity.y;
      p.position.z += p.velocity.z + Math.cos(t * 0.3 + p.phase) * 0.008;
      p.rotation += p.rotationSpeed;

      // 바닥 아래로 내려가면 위로 리셋 (애니메이션 루프 내의 무작위성은 허용됨)
      if (p.position.y < 0) {
        p.position.y = 10 + Math.random() * 4;
        p.position.x = getRandomPos(PETAL_SPREAD);
        p.position.z = getRandomPos(PETAL_SPREAD);
      }

      // InstancedMesh 행렬 적용
      dummy.position.copy(p.position);
      dummy.rotation.set(p.rotation, p.rotation * 0.7, p.rotation * 0.5);
      dummy.scale.setScalar(0.06 + Math.sin(t + p.phase) * 0.01);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // 색상 적용
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
// 반딧불이 파티클 (밤 동안 반짝이는 효과)
// ─────────────────────────────────────────────
const FIREFLY_COUNT = 30;

const generateFireflyData = () => {
  const temp = [];
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

  const fireflies = useMemo(() => generateFireflyData(), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;

    fireflies.forEach((f, i) => {
      // 원을 그리며 부유
      const x = f.position.x + Math.sin(t * f.speed + f.phase) * f.radius;
      const y = f.position.y + Math.sin(t * f.speed * 1.3 + f.phase) * 0.4;
      const z = f.position.z + Math.cos(t * f.speed + f.phase) * f.radius;

      dummy.position.set(x, y, z);
      dummy.scale.setScalar(0.02 + Math.abs(Math.sin(t * 3 + f.phase)) * 0.04);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // 반짝임: 밝아졌다 어두워졌다 (따뜻한 노란색/황금색 계열)
      const brightness = 0.4 + Math.abs(Math.sin(t * 3 + f.phase)) * 0.6;
      color.setHSL(
        0.13 + Math.sin(f.phase) * 0.02, // 0.11 ~ 0.15: 따뜻한 노란색
        1.0,
        brightness * 0.8,
      );
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
