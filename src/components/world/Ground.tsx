import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useMemo } from "react";

export const Ground = () => {
  const grassTexture = useTexture("/textures/ground/grass.png");

  const groundTexture = useMemo(() => {
    const t = grassTexture.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(20, 20); // 넓어진 ground에 맞게 타일 수 증가
    t.anisotropy = 16;
    return t;
  }, [grassTexture]);

  return (
    <group>
      {/* 넓어진 메인 잔디 바닥 (집 크기에 맞게 60x60) */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[80, 80, 1, 1]} />
        <meshStandardMaterial
          map={groundTexture}
          color="#a8d876"
          roughness={0.85}
          metalness={0.0}
        />
      </mesh>

      {/* 안쪽 원형 잔디 (부드러운 색상 분리) */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.008, 0]}>
        <planeGeometry args={[33, 33, 1, 1]} />
        <meshStandardMaterial
          color="#8fcf5a"
          roughness={0.9}
          metalness={0.0}
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* 집 앞 마당 흙길 (집 영역 앞쪽, 살짝 앞으로 이동) */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.005, 0]}>
        <circleGeometry args={[4.5, 32]} />
        <meshStandardMaterial color="#c4a46b" roughness={1.0} metalness={0.0} />
      </mesh>

      {/* 집까지의 흙길 (패스) */}
      <mesh
        rotation-x={-Math.PI / 2}
        receiveShadow
        position={[0, -0.004, -3.5]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[2.5, 5]} />
        <meshStandardMaterial color="#c8a870" roughness={1.0} metalness={0.0} />
      </mesh>
    </group>
  );
};
