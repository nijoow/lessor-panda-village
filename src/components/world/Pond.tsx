'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PondProps {
  position: [number, number, number];
  scale?: number;
}

interface RockData {
  x: number;
  z: number;
  scale: [number, number, number];
  rotation: number;
}

// 고정된 데이터 (Idempotent render를 위해 Math.random 제거)
const POND_ROCKS: RockData[] = [
  { x: 3.1, z: 0.5, scale: [1.2, 0.6, 1.1], rotation: 0.5 },
  { x: 2.2, z: 2.1, scale: [0.9, 0.5, 1.0], rotation: 1.2 },
  { x: 0.2, z: 3.2, scale: [1.3, 0.7, 1.2], rotation: 2.4 },
  { x: -1.8, z: 2.8, scale: [1.0, 0.4, 0.9], rotation: 0.1 },
  { x: -2.9, z: 0.8, scale: [1.1, 0.6, 1.2], rotation: 1.8 },
  { x: -2.4, z: -2.2, scale: [0.8, 0.5, 0.9], rotation: 3.1 },
  { x: -0.5, z: -3.0, scale: [1.4, 0.7, 1.3], rotation: 0.9 },
  { x: 1.5, z: -2.5, scale: [1.0, 0.4, 1.1], rotation: 2.1 },
  { x: 2.8, z: -1.2, scale: [1.1, 0.6, 1.0], rotation: 0.4 },
  { x: 1.9, z: 1.2, scale: [0.8, 0.4, 0.8], rotation: 1.5 },
  { x: -1.2, z: 1.8, scale: [0.9, 0.5, 1.1], rotation: 2.7 },
  { x: -0.8, z: -1.8, scale: [1.2, 0.6, 1.3], rotation: 0.2 },
];

export const Pond = ({ position, scale = 1 }: PondProps) => {
  const waterRef = useRef<THREE.Mesh>(null!);

  // 수면 애니메이션 (은은한 물결 효과)
  useFrame((state) => {
    if (waterRef.current) {
      const t = state.clock.getElapsedTime();
      waterRef.current.rotation.z = Math.sin(t * 0.2) * 0.05;
      waterRef.current.scale.setScalar(1 + Math.sin(t * 0.4) * 0.01);
    }
  });

  return (
    <group position={position} scale={scale}>
      {/* 연못 바닥 (살짝 깊이감 있게) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.2, 0]}>
        <circleGeometry args={[2.8, 32]} />
        <meshStandardMaterial color="#1a237e" roughness={1} />
      </mesh>

      {/* 수면 */}
      <mesh
        ref={waterRef}
        rotation-x={-Math.PI / 2}
        position={[0, 0.05, 0]}
        receiveShadow
      >
        <circleGeometry args={[2.7, 32]} />
        <meshStandardMaterial
          color="#42a5f5"
          transparent
          opacity={0.65}
          roughness={0.1}
          metalness={0.5}
        />
      </mesh>

      {/* 연못 테두리 돌들 */}
      {POND_ROCKS.map((rock, i) => (
        <mesh
          key={i}
          position={[rock.x, 0.1, rock.z]}
          scale={rock.scale}
          rotation={[0, rock.rotation, 0]}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial color="#6d6d6d" roughness={0.9} />
        </mesh>
      ))}

      {/* 수생 식물 (간단한 수선화 느낌) */}
      <group position={[1.2, 0.08, -0.8]} scale={0.4}>
        <mesh castShadow>
          <sphereGeometry args={[0.4, 8, 8]} />
          <meshStandardMaterial color="#4caf50" />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.05, 0.3, 0.5, 6]} />
          <meshStandardMaterial color="#fff176" />
        </mesh>
      </group>

      <group position={[-1.0, 0.08, 1.4]} scale={0.3}>
        <mesh castShadow>
          <sphereGeometry args={[0.4, 8, 8]} />
          <meshStandardMaterial color="#4caf50" />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.05, 0.3, 0.5, 6]} />
          <meshStandardMaterial color="#fff176" />
        </mesh>
      </group>
    </group>
  );
};
