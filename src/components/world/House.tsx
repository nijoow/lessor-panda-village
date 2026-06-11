"use client";

import { useGLTF } from "@react-three/drei";
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
  const { nodes } = useGLTF("/models/house/panda_house.glb");

  // GLB 그래프는 런타임에만 형상이 확정되므로 단언 대신 instanceof로 검증
  const houseMesh = nodes.mesh_0;
  if (!(houseMesh instanceof THREE.Mesh)) return null;

  return (
    <group position={position} rotation={rotation} scale={scale} dispose={null}>
      <mesh
        geometry={houseMesh.geometry}
        material={houseMesh.material}
        castShadow
        receiveShadow
      />
    </group>
  );
};

useGLTF.preload("/models/house/panda_house.glb");
