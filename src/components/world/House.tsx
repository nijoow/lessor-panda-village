"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

interface Props {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}

export const House = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}: Props) => {
  const { scene } = useGLTF("/models/house/panda_house.glb");

  // 지오메트리만 꺼내 쓰면 GLB 노드 자체의 변환이 사라진다.
  // meshopt 양자화는 정점을 정규화 범위로 굽고 노드 스케일로 원래 크기를
  // 복원하므로, 씬을 통째로 복제해야 압축 전후 크기가 같게 유지된다.
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return (
    <group position={position} rotation={rotation} scale={scale} dispose={null}>
      <primitive object={model} />
    </group>
  );
};

useGLTF.preload("/models/house/panda_house.glb");
