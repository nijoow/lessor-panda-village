"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { worldFrameState } from "@/runtime/worldFrameState";

const CHECK_INTERVAL = 0.2;
// Spread large-model tests across frames even when several checks become due.
let lastNarrowPhaseFrame = -1;
const OCCLUDED_OPACITY = 0.2;

/** A finite sight segment, never an infinite ray extending behind the camera. */
export function intersectsSightSegment(
  ray: THREE.Ray,
  distance: number,
  box: THREE.Box3,
  hit: THREE.Vector3,
) {
  if (box.isEmpty() || distance < 0.1) return false;
  if (box.containsPoint(ray.origin)) return true;
  return (
    ray.intersectBox(box, hit) !== null &&
    hit.distanceToSquared(ray.origin) < (distance - 0.05) ** 2
  );
}

/** Only the cloned materials are mutable; cached GLTF geometry/textures stay shared. */
export function cloneCameraOccluder(source: THREE.Group) {
  const model = source.clone(true);
  const originals = new Map<
    THREE.Material,
    {
      material: THREE.Material;
      opacity: number;
      transparent: boolean;
      depthWrite: boolean;
    }
  >();
  const shadowMaterials: THREE.Material[] = [];
  const cloneMaterial = (sourceMaterial: THREE.Material) => {
    let entry = originals.get(sourceMaterial);
    if (!entry) {
      entry = {
        material: sourceMaterial.clone(),
        opacity: sourceMaterial.opacity,
        transparent: sourceMaterial.transparent,
        depthWrite: sourceMaterial.depthWrite,
      };
      originals.set(sourceMaterial, entry);
    }
    return entry.material;
  };
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material;
    object.material = Array.isArray(material)
      ? material.map(cloneMaterial)
      : cloneMaterial(material);
    object.castShadow = true;
    object.receiveShadow = true;
    // Both supplied scenery GLBs have one opaque material. Keep their original
    // opaque shadow even while the main colour pass fades for visibility.
    const depth =
      object.customDepthMaterial?.clone() ??
      new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
        side: (Array.isArray(material) ? material[0] : material).side,
      });
    object.customDepthMaterial = depth;
    shadowMaterials.push(depth);
  });
  return {
    model,
    materials: [...originals.values()],
    setOpacity: (alpha: number) => {
      const fading = alpha < 1;
      for (const entry of originals.values()) {
        const transparent = fading || entry.transparent;
        if (entry.material.transparent !== transparent) {
          entry.material.transparent = transparent;
          entry.material.needsUpdate = true;
        }
        entry.material.opacity = entry.opacity * alpha;
        // A faded building must not still write an opaque depth silhouette over
        // the panda. Depth testing remains enabled for the rest of the scene.
        entry.material.depthWrite = fading ? false : entry.depthWrite;
      }
    },
    dispose: () => {
      for (const entry of originals.values()) entry.material.dispose();
      for (const material of shadowMaterials) material.dispose();
    },
  };
}

/** Static world bounds are rebuilt only when placement changes, never per frame. */
export function useCameraOccluder(source: THREE.Group, placementKey: string) {
  const resource = useMemo(() => cloneCameraOccluder(source), [source]);
  const runtimeRef = useRef({
    bounds: new THREE.Box3(),
    ray: new THREE.Ray(),
    hit: new THREE.Vector3(),
    raycaster: new THREE.Raycaster(),
    intersections: [] as THREE.Intersection[],
    checkIn: 0,
    alpha: 1,
    targetAlpha: 1,
  });

  useLayoutEffect(() => {
    const runtime = runtimeRef.current;
    resource.model.updateWorldMatrix(true, true);
    runtime.bounds.setFromObject(resource.model);
    runtime.checkIn = 0;
  }, [resource, placementKey]);

  useLayoutEffect(() => () => resource.dispose(), [resource]);

  useFrame((state, delta) => {
    const runtime = runtimeRef.current;
    const dt = Math.min(delta, 0.1);
    runtime.checkIn -= delta;
    if (runtime.checkIn <= 0) {
      runtime.checkIn = CHECK_INTERVAL;
      const player = worldFrameState.player;
      runtime.ray.origin.set(player.x, player.y + 1.4, player.z);
      runtime.ray.direction.subVectors(
        state.camera.position,
        runtime.ray.origin,
      );
      const distance = runtime.ray.direction.length();
      runtime.ray.direction.normalize();
      const possibleOcclusion =
        resource.model.visible &&
        intersectsSightSegment(
          runtime.ray,
          distance,
          runtime.bounds,
          runtime.hit,
        );
      if (!possibleOcclusion) {
        runtime.targetAlpha = 1;
      } else if (lastNarrowPhaseFrame === state.clock.elapsedTime) {
        runtime.checkIn = 0; // Try next frame; never batch multiple GLB scans.
      } else {
        lastNarrowPhaseFrame = state.clock.elapsedTime;
        // Shoot from the camera so FrontSide meshes match visible front faces.
        // A point inside a broad bounds box is not itself evidence of a blocker.
        runtime.raycaster.ray.origin.copy(state.camera.position);
        runtime.raycaster.ray.direction.copy(runtime.ray.direction).negate();
        runtime.raycaster.near = 0.05;
        runtime.raycaster.far = Math.max(0.05, distance - 0.15);
        runtime.intersections.length = 0;
        runtime.raycaster.intersectObject(
          resource.model,
          true,
          runtime.intersections,
        );
        runtime.targetAlpha =
          runtime.intersections.length > 0 ? OCCLUDED_OPACITY : 1;
      }
    }
    if (runtime.alpha === runtime.targetAlpha) return;
    runtime.alpha = THREE.MathUtils.lerp(
      runtime.alpha,
      runtime.targetAlpha,
      1 - Math.exp(-dt * 9),
    );
    if (Math.abs(runtime.alpha - runtime.targetAlpha) < 0.005)
      runtime.alpha = runtime.targetAlpha;
    resource.setOpacity(runtime.alpha);
  });

  return resource.model;
}
