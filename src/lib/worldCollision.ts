import { checkCollision } from "@/utils/collision";
import { useHarvestStore } from "@/stores/harvestStore";

/** Adapts the live harvest state to the otherwise pure world collision query. */
export const checkWorldCollision = (x: number, z: number, y = 0) =>
  checkCollision(x, z, y, useHarvestStore.getState().isHarvested);
