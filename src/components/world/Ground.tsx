import { Grid, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useMemo } from 'react';

export const Ground = () => {
  // 1. 텍스처를 불러옵니다.
  const grassTexture = useTexture('/textures/ground/grass.png');

  // 2. 텍스처 복제 및 설정 (공유 텍스처의 변형 방지)
  const groundTexture = useMemo(() => {
    const t = grassTexture.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(8, 8);
    return t;
  }, [grassTexture]);

  return (
    <group>
      {/* 
        Ground Plane: 텍스처를 map 속성에 연결합니다.
      */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow position-y={-0.01}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial 
          map={groundTexture} 
          roughness={0.8} 
          metalness={0.2} 
        />
      </mesh>

      {/* 
        2. Grid: 좌표를 쉽게 알 수 있게 격자를 그려줍니다. 
           Drei의 Grid 컴포넌트로 간편하게 격자를 시각화할 수 있습니다.
      */}
      <Grid 
        infiniteGrid 
        fadeDistance={50} 
        fadeStrength={5} 
        sectionSize={3} 
        sectionColor="#66aa66"
        sectionThickness={1.5}
        cellSize={1}
        cellColor="#448844"
        cellThickness={1}
      />
    </group>
  );
};
