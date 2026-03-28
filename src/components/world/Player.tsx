"use client";

import { useFrame } from "@react-three/fiber";
import { useKeyboardControls, RoundedBox, useTexture } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

export enum Controls {
  forward = "forward",
  backward = "backward",
  left = "left",
  right = "right",
}

export const Player = () => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [, getKeys] = useKeyboardControls();

  // 1. 텍스처를 불러옵니다.
  const furTexture = useTexture("/textures/player/fur.png");

  // 2. 이동 속도를 정의합니다.
  const speed = 0.05;
  // 3. 부드러운 움직임을 위한 목표 위치 벡터입니다.
  const targetPosition = useRef(new THREE.Vector3(0, 0.5, 0));

  useFrame((state) => {
    const { forward, backward, left, right } = getKeys();

    // 4. 키보드 입력에 따라 목표 위치를 변경합니다. (Isometric 보정)
    if (forward) {
      targetPosition.current.x -= speed;
      targetPosition.current.z -= speed;
    }
    if (backward) {
      targetPosition.current.x += speed;
      targetPosition.current.z += speed;
    }
    if (left) {
      targetPosition.current.x -= speed;
      targetPosition.current.z += speed;
    }
    if (right) {
      targetPosition.current.x += speed;
      targetPosition.current.z -= speed;
    }

    // 5. 부드럽게 위치를 보간(Interpolation)합니다.
    meshRef.current.position.x = THREE.MathUtils.lerp(
      meshRef.current.position.x,
      targetPosition.current.x,
      0.2,
    );
    meshRef.current.position.z = THREE.MathUtils.lerp(
      meshRef.current.position.z,
      targetPosition.current.z,
      0.2,
    );

    // 6. 카메라가 캐릭터를 따라오게 만듭니다.
    state.camera.position.x = meshRef.current.position.x + 8;
    state.camera.position.y = meshRef.current.position.y + 8;
    state.camera.position.z = meshRef.current.position.z + 8;
    state.camera.lookAt(meshRef.current.position);
  });

  return (
    <RoundedBox
      ref={meshRef}
      args={[1, 1, 1]} // 가로, 세로, 높이
      radius={0.2} // 둥글기 정도
      smoothness={4} // 둥근 부분의 세밀함
      castShadow
    >
      <meshStandardMaterial
        map={furTexture}
        color="#ff8844" // 텍스처 위에 레드 판다 색상을 살짝 섞어줍니다.
        roughness={0.9}
      />
    </RoundedBox>
  );
};
