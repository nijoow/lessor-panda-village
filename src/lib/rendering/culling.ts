import { Fog, type Scene } from "three";
import { WORLD_FOG, SCENERY_CULL_MARGIN } from "@/constants/rendering";

export const getFogFar = (scene: Scene) =>
  scene.fog instanceof Fog ? scene.fog.far : WORLD_FOG.day.far;

/** Linear fog is measured in view-space depth; keep visible edges of a sphere. */
export const fogSphereVisible = (
  depth: number,
  radius: number,
  far: number,
  margin = SCENERY_CULL_MARGIN,
) => depth - radius <= far + margin;
