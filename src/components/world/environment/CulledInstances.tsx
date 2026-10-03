"use client";

import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import { worldFrameState } from "@/runtime/worldFrameState";
import { SCENERY_CULL_UPDATE_DISTANCE } from "@/constants/rendering";
import { type StaticInstanceRecord } from "./instanceData";
import { getFogFar, fogSphereVisible } from "@/lib/rendering/culling";

interface CulledInstancesProps {
  name: string;
  records: readonly StaticInstanceRecord[];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/**
 * 정적 인스턴스의 행렬을 카메라 근처 레코드만 앞쪽 슬롯으로 압축한다.
 * draw call은 타입당 하나로 유지하면서 안개 밖 정점은 GPU에 보내지 않는다.
 */
export const CulledInstances = ({
  name,
  records,
  geometry,
  material,
  castShadow = false,
  receiveShadow = false,
}: CulledInstancesProps) => {
  const lastVisible = useRef<number[] | null>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const lastCameraRef = useRef({ x: Infinity, y: Infinity, z: Infinity, fogFar: -1 });
  const { camera, scene } = useThree();
  const lastQuaternion = useRef(new THREE.Quaternion());
  const point = useRef(new THREE.Vector3());
  const spheres = useMemo(() => {
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    return records.map((record) => geometry.boundingSphere!.clone().applyMatrix4(record.matrix));
  }, [geometry, records]);

  const updateInstances = useCallback(
    (state: Pick<RootState, "camera" | "scene">) => {
      const mesh = meshRef.current;
      if (!mesh) return;

      const fogFar = getFogFar(state.scene);
      state.camera.updateMatrixWorld();
      const visibleIndices: number[] = [];
      records.forEach((_record, index) => {
        const sphere = spheres[index];
        point.current.copy(sphere.center).applyMatrix4(state.camera.matrixWorldInverse);
        if (fogSphereVisible(-point.current.z, sphere.radius, fogFar)) visibleIndices.push(index);
      });
      lastQuaternion.current.copy(state.camera.quaternion);
      lastCameraRef.current = {
        x: state.camera.position.x,
        y: state.camera.position.y,
        z: state.camera.position.z,
        fogFar,
      };
      // Orbiting inside the same fog range must not re-upload every static mesh
      // or invalidate a cached shadow map when its caster list did not change.
      const previous = lastVisible.current;
      if (previous && previous.length === visibleIndices.length && previous.every((index, slot) => index === visibleIndices[slot])) return;
      lastVisible.current = visibleIndices;
      visibleIndices.forEach((index, slot) => {
        const record = records[index];
        mesh.setMatrixAt(slot, record.matrix);
        if (record.color) mesh.setColorAt(slot, record.color);
      });
      const visibleCount = visibleIndices.length;
      worldFrameState.invalidateShadows();
      mesh.count = visibleCount;
      mesh.visible = visibleCount > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

      // InstancedMesh의 기본 boundingSphere는 이전 count를 기억할 수 있다.
      // 압축한 목록 기준으로 다시 계산해야 Three의 frustum culling도 안전하다.
      mesh.boundingSphere = null;
      if (visibleCount > 0) mesh.computeBoundingSphere();


    },
    [records, spheres],
  );

  useLayoutEffect(() => {
    lastVisible.current = null;
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    updateInstances({ camera, scene });
  }, [camera, scene, updateInstances]);

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

    updateInstances(state);
  });

  return (
    <instancedMesh
      ref={meshRef}
      name={name}
      args={[geometry, material, records.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
};
