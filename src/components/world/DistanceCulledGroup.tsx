"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import * as THREE from "three";
import { worldFrameState } from "@/runtime/worldFrameState";
import { SCENERY_CULL_UPDATE_DISTANCE } from "@/constants/rendering";
import { getFogFar, fogSphereVisible } from "@/lib/rendering/culling";

interface DistanceCulledGroupProps {
  center: readonly [number, number];
  radius?: number;
  children: ReactNode;
}

/**
 * 실제 그룹 경계 구 전체가 view-space fog far 뒤에 있을 때만 끈다.
 * 카메라 회전도 감지해 화면 가장자리의 방사형 거리 팝인을 피한다.
 */
export const DistanceCulledGroup = ({
  center,
  radius = 0,
  children,
}: DistanceCulledGroupProps) => {
  const groupRef = useRef<THREE.Group>(null!);
  const lastCameraRef = useRef({
    x: Infinity,
    y: Infinity,
    z: Infinity,
    fogFar: -1,
  });
  const lastQuaternion = useRef(new THREE.Quaternion());
  const bounds = useRef(
    new THREE.Sphere(new THREE.Vector3(center[0], 0, center[1]), radius),
  );
  const depthPoint = useRef(new THREE.Vector3());
  const { camera, scene } = useThree();

  const updateVisibility = useCallback(
    (state: Pick<RootState, "camera" | "scene">) => {
      const fogFar = getFogFar(state.scene);
      state.camera.updateMatrixWorld();
      depthPoint.current
        .copy(bounds.current.center)
        .applyMatrix4(state.camera.matrixWorldInverse);
      // Three's linear fog uses view-space depth, not radial ground distance.
      const visible = fogSphereVisible(
        -depthPoint.current.z,
        bounds.current.radius,
        fogFar,
      );
      if (groupRef.current.visible !== visible)
        worldFrameState.invalidateShadows();
      groupRef.current.visible = visible;
      lastQuaternion.current.copy(state.camera.quaternion);
      lastCameraRef.current = {
        x: state.camera.position.x,
        y: state.camera.position.y,
        z: state.camera.position.z,
        fogFar,
      };
    },
    [],
  );

  useLayoutEffect(() => {
    const box = new THREE.Box3().setFromObject(groupRef.current);
    if (!box.isEmpty()) box.getBoundingSphere(bounds.current);
    updateVisibility({ camera, scene });
  }, [camera, scene, updateVisibility]);

  useFrame((state) => {
    const last = lastCameraRef.current;
    const dx = state.camera.position.x - last.x;
    const dy = state.camera.position.y - last.y;
    const dz = state.camera.position.z - last.z;
    const fogFar = getFogFar(state.scene);

    if (
      dx * dx + dy * dy + dz * dz <
        SCENERY_CULL_UPDATE_DISTANCE * SCENERY_CULL_UPDATE_DISTANCE &&
      Math.abs(fogFar - last.fogFar) < 0.5 &&
      lastQuaternion.current.angleTo(state.camera.quaternion) < 0.01
    ) {
      return;
    }

    updateVisibility(state);
  });

  return <group ref={groupRef}>{children}</group>;
};
