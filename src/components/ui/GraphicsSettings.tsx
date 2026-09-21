"use client";

import { useGraphicsStore } from "@/stores/graphicsStore";
import type { GraphicsMode } from "@/constants/rendering";

const LABELS = { auto: "자동", low: "낮음", medium: "보통", high: "높음" } as const;

export function GraphicsSettings() {
  const mode = useGraphicsStore((state) => state.mode);
  const setMode = useGraphicsStore((state) => state.setMode);
  return (
    <label className="pointer-events-auto flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/10 pl-3 pr-1 text-sm text-white">
      <span>화질</span>
      <select aria-label="그래픽 화질" value={mode} onChange={(event) => setMode(event.target.value as GraphicsMode)} className="min-h-11 min-w-24 rounded-xl bg-transparent px-2 text-white outline-offset-2 focus-visible:outline-2 focus-visible:outline-orange-200">
        {Object.entries(LABELS).map(([value, label]) => <option key={value} value={value} className="bg-sky-950 text-white">{label}</option>)}
      </select>
    </label>
  );
}
