"use client";

import { useEffect } from "react";
import { useHarvestStore } from "@/stores/harvestStore";
import { worldFrameState } from "@/runtime/worldFrameState";

export function useWorldShadowSignals() {
  useEffect(() => useHarvestStore.subscribe((state, previous) => {
    if (state.revision !== previous.revision) worldFrameState.invalidateShadows();
  }), []);
}
