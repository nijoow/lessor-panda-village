"use client";

import { create } from "zustand";
import { GRAPHICS_PRESETS, type GraphicsMode, type GraphicsQuality } from "@/constants/rendering";

export interface GraphicsMetrics {
  frameMs: number;
  p95FrameMs: number;
  fps: number;
  samples: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  width: number;
  height: number;
}

interface GraphicsState {
  mode: GraphicsMode;
  quality: GraphicsQuality;
  dpr: number;
  metrics: GraphicsMetrics;
  /** Render-loop signals. Mutating these does not notify React subscribers. */
  runtime: { shadowRevision: number; playerY: number; animationUntil: number };
  setMode: (mode: GraphicsMode) => void;
  setAutomaticQuality: (quality: GraphicsQuality, dpr?: number) => void;
  reportMetrics: (metrics: GraphicsMetrics) => void;
}

export const useGraphicsStore = create<GraphicsState>((set, get) => ({
  mode: "auto",
  quality: "low",
  dpr: 1,
  metrics: { frameMs: 0, p95FrameMs: 0, fps: 0, samples: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0, width: 0, height: 0 },
  runtime: { shadowRevision: 0, playerY: 0, animationUntil: 0 },
  setMode: (mode) => {
    const quality = mode === "auto" ? "low" : mode;
    set({ mode, quality, dpr: GRAPHICS_PRESETS[quality].dpr });
    try { localStorage.setItem("panda-graphics-v1", mode); } catch { /* Private browsing may disable storage. */ }
  },
  setAutomaticQuality: (quality, dpr = GRAPHICS_PRESETS[quality].dpr) => {
    if (get().mode === "auto") set({ quality, dpr });
  },
  reportMetrics: (metrics) => set({ metrics }),
}));
