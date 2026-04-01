"use client";

import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GLTF } from "three-stdlib";

type GLTFResult = GLTF & {
  nodes: {
    mesh_0: THREE.Mesh;
  };
  materials: Record<string, THREE.Material>;
};

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
  const { nodes } = useGLTF(
    "/models/house/panda_house.glb",
  ) as unknown as GLTFResult;

  return (
    <group position={position} rotation={rotation} scale={scale} dispose={null}>
      <mesh
        geometry={nodes.mesh_0.geometry}
        material={nodes.mesh_0.material}
        castShadow
        receiveShadow
      />
    </group>
  );
};

useGLTF.preload("/models/house/panda_house.glb");
