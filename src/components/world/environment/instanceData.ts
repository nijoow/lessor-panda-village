import * as THREE from "three";

export interface StaticInstanceRecord {
  x: number;
  z: number;
  matrix: THREE.Matrix4;
  color?: THREE.Color;
}

type TransformScale = number | readonly [number, number, number];

export const staticInstance = ({
  position,
  scale = 1,
  rotation = [0, 0, 0],
  color,
}: {
  position: readonly [number, number, number];
  scale?: TransformScale;
  rotation?: readonly [number, number, number];
  color?: THREE.ColorRepresentation;
}): StaticInstanceRecord => {
  const scaleVector =
    typeof scale === "number"
      ? new THREE.Vector3(scale, scale, scale)
      : new THREE.Vector3(...scale);
  const quaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(...rotation),
  );

  return {
    x: position[0],
    z: position[2],
    matrix: new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      quaternion,
      scaleVector,
    ),
    color: color === undefined ? undefined : new THREE.Color(color),
  };
};
