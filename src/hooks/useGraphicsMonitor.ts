"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGraphicsStore } from "@/stores/graphicsStore";
import type { GraphicsMode } from "@/constants/rendering";

/** Decisions use contiguous visible samples, never wall time spent in another tab. */
export class FrameQualityMonitor {
  private warmup = 5;
  private elapsed = 0;
  private samples: number[] = [];
  private slowSeconds = 0;
  private fastSeconds = 0;
  reset(warmup = 3) {
    this.warmup = warmup;
    this.elapsed = 0;
    this.samples = [];
    this.slowSeconds = 0;
    this.fastSeconds = 0;
  }
  sample(delta: number, visible: boolean) {
    if (!visible || !Number.isFinite(delta) || delta <= 0 || delta > 0.5) {
      this.reset();
      return null;
    }
    if (this.warmup > 0) { this.warmup -= delta; return null; }
    this.elapsed += delta;
    this.samples.push(delta * 1000);
    if (this.elapsed < 1) return null;
    const elapsed = this.elapsed;
    const samples = this.samples;
    const frameMs = elapsed * 1000 / samples.length;
    const sorted = [...samples].sort((a, b) => a - b);
    const p95FrameMs = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    const slow = frameMs > 36 || p95FrameMs > 48;
    const fast = frameMs < 22 && p95FrameMs < 28;
    this.slowSeconds = slow ? this.slowSeconds + elapsed : 0;
    this.fastSeconds = fast ? this.fastSeconds + elapsed : 0;
    const direction = this.slowSeconds >= 3 ? -1 : this.fastSeconds >= 30 ? 1 : 0;
    this.elapsed = 0;
    this.samples = [];
    if (direction !== 0) this.reset(5);
    return { frameMs, p95FrameMs, fps: 1000 / frameMs, samples: samples.length, direction };
  }
}

export function useGraphicsMonitor() {
  const monitor = useRef(new FrameQualityMonitor());
  const mode = useGraphicsStore((state) => state.mode);
  const quality = useGraphicsStore((state) => state.quality);
  const dpr = useGraphicsStore((state) => state.dpr);
  const getThree = useThree((state) => state.get);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("panda-graphics-v1");
      if (["auto", "low", "medium", "high"].includes(stored ?? "")) {
        useGraphicsStore.getState().setMode(stored as GraphicsMode);
      }
    } catch { /* Storage is optional. */ }
    // Read-only diagnostics for repeatable browser captures, hidden from the HUD.
    const diagnostics = () => {
      const { mode, quality, dpr, metrics } = useGraphicsStore.getState();
      return { mode, quality, dpr, ...metrics };
    };
    const target = window as Window & { __PANDA_GRAPHICS__?: typeof diagnostics };
    target.__PANDA_GRAPHICS__ = diagnostics;
    const onVisibility = () => monitor.current.reset();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      delete target.__PANDA_GRAPHICS__;
    };
  }, []);

  useEffect(() => { monitor.current.reset(5); }, [mode, quality, dpr]);
  useEffect(() => {
    // Keep counters across all scene/composer passes until the next frame.
    const { gl } = getThree();
    gl.info.autoReset = false;
    return () => { gl.info.autoReset = true; };
  }, [getThree]);

  useFrame((state, delta) => {
    const sample = monitor.current.sample(delta, document.visibilityState === "visible");
    const store = useGraphicsStore.getState();
    if (sample) {
      const { direction, ...timings } = sample;
      const buffer = state.gl.domElement;
      store.reportMetrics({ ...timings, drawCalls: state.gl.info.render.calls, triangles: state.gl.info.render.triangles, geometries: state.gl.info.memory.geometries, textures: state.gl.info.memory.textures, width: buffer.width, height: buffer.height });
      if (direction < 0) {
        if (store.quality === "high") store.setAutomaticQuality("medium");
        else if (store.quality === "medium") store.setAutomaticQuality("low");
        else store.setAutomaticQuality("low", 0.75);
      } else if (direction > 0) {
        if (store.dpr < 1) store.setAutomaticQuality("low", 1);
        else if (store.quality === "low") store.setAutomaticQuality("medium");
        else if (store.quality === "medium") store.setAutomaticQuality("high");
      }
    }
    state.gl.info.reset();
  }, -100);
}
