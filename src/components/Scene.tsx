'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Sky } from '@react-three/drei';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export const Scene = ({ children }: Props) => {
  return (
    <Canvas shadows>
      {/* 
        1. PerspectiveCamera: 원근감이 있는 카메라입니다. 
           makeDefault로 설정하여 이 카메라를 기본으로 사용합니다.
           포지션을 [5, 5, 5] 정도로 설정하여 위에서 내려다보는 시점을 만듭니다.
      */}
      <PerspectiveCamera 
        makeDefault 
        position={[14, 14, 14]} 
        fov={40} 
      />

      {/* 
        2. OrbitControls: 마우스로 화면을 돌려볼 수 있게 해줍니다.
           마을을 만드는 동안 자유롭게 관찰하기 위해 추가합니다.
      */}
      <OrbitControls makeDefault />

      {/* 
        3. Lights: 3D 세상에는 빛이 없으면 아무것도 보이지 않습니다 (완전 암흑).
           AmbientLight - 전체적으로 은은하게 비춰주는 환경광 (강도를 약간 낮춰 입체감을 살립니다)
           DirectionalLight - 태양처럼 한 방향에서 쏟아지는 빛 (그림자를 만듭니다)
      */}
      {/* 하늘 배경 */}
      <Sky
        distance={450}
        sunPosition={[10, 5, 8]}
        inclination={0.52}
        azimuth={0.25}
        turbidity={6}
        rayleigh={0.5}
      />

      <ambientLight intensity={1.0} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={2.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />

      {children}
    </Canvas>
  );
};
