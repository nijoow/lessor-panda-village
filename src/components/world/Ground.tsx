"use client";

import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useMemo } from "react";

// ---------- 돌길 컴포넌트 (작은 돌들을 배치하여 입체적인 길 표현) ----------
const SteppingStone = ({
  position,
  scale = 1,
  rotation = 0,
}: {
  position: [number, number, number];
  scale?: number;
  rotation?: number;
}) => (
  <mesh
    position={position}
    rotation={[-Math.PI / 2, 0, rotation]}
    receiveShadow
  >
    <circleGeometry args={[0.4 * scale, 8]} />
    <meshStandardMaterial color="#9e9e9e" roughness={0.9} />
  </mesh>
);

const StonePath = ({
  start,
  end,
  width = 2,
  density = 1.5,
}: {
  start: [number, number];
  end: [number, number];
  width?: number;
  density?: number;
}) => {
  const stones = useMemo(() => {
    const temp = [];
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const dist = Math.sqrt(dx * dx + dz * dz);
    const count = Math.floor(dist * density);

    for (let i = 0; i < count; i++) {
      const t = i / count;
      const x = start[0] + dx * t + Math.sin(i * 1.5) * width * 0.3;
      const z = start[1] + dz * t + Math.cos(i * 0.8) * width * 0.2;
      // Idempotent values (Math.random 대신 인덱스 활용)
      const s = 0.8 + Math.sin(i * 2.1) * 0.3;
      const r = i * 0.5;
      temp.push({ x, z, s, r });
    }
    return temp;
  }, [start, end, width, density]);

  return (
    <group>
      {stones.map((stone, i) => (
        <SteppingStone
          key={i}
          position={[stone.x, -0.003, stone.z]}
          scale={stone.s}
          rotation={stone.r}
        />
      ))}
    </group>
  );
};

export const Ground = () => {
  const grassTexture = useTexture("/textures/ground/grass.png");

  const groundTexture = useMemo(() => {
    const t = grassTexture.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(20, 20);
    t.anisotropy = 16;
    return t;
  }, [grassTexture]);

  return (
    <group>
      {/* 메인 잔디 바닥 */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial
          map={groundTexture}
          color="#a8d876"
          roughness={0.85}
        />
      </mesh>

      {/* 안쪽 원형 잔디 */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.008, 0]}>
        <planeGeometry args={[33, 33]} />
        <meshStandardMaterial color="#8fcf5a" transparent opacity={0.55} />
      </mesh>

      {/* 베이스 흙길 (Subtle) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.005, -3]} receiveShadow>
        <circleGeometry args={[4.5, 36]} />
        <meshStandardMaterial color="#bda17a" roughness={1.0} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-2, -0.005, 5]} receiveShadow>
        <circleGeometry args={[7, 32]} />
        <meshStandardMaterial color="#bda17a" roughness={1.0} />
      </mesh>

      {/* 입체 돌길 (Stone Paths) */}
      {/* 집 앞마당 -> 중앙 광장 */}
      <StonePath start={[0, -2]} end={[0, 4]} width={3} density={2.5} />

      {/* 중앙 광장 -> 연못 (x:8, z:6) */}
      <StonePath start={[2, 5]} end={[6, 6]} width={2} density={2} />

      {/* 집 -> 왼쪽 나무 구역 */}
      <StonePath start={[-2, -2]} end={[-6, 0]} width={1.5} density={1.8} />
    </group>
  );
};
