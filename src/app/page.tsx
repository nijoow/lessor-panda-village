"use client";

import { KeyboardControls, KeyboardControlsEntry } from "@react-three/drei";
import { Scene } from "@/components/Scene";
import { Ground } from "@/components/world/Ground";
import { Player, Controls } from "@/components/world/Player";
import { Environment } from "@/components/world/Environment";
import { House } from "@/components/world/House";
import { PetalParticles, FireflyParticles } from "@/components/world/Particles";
import { useMemo, useState } from "react";

export default function Home() {
  const [isNight, setIsNight] = useState(false);

  const map = useMemo<KeyboardControlsEntry<Controls>[]>(
    () => [
      { name: Controls.forward, keys: ["ArrowUp", "KeyW"] },
      { name: Controls.backward, keys: ["ArrowDown", "KeyS"] },
      { name: Controls.left, keys: ["ArrowLeft", "KeyA"] },
      { name: Controls.right, keys: ["ArrowRight", "KeyD"] },
      { name: Controls.run, keys: ["ShiftLeft", "ShiftRight"] },
    ],
    [],
  );

  return (
    <main className="w-full h-full relative">
      {/* UI Layer */}
      <div className="absolute top-10 left-0 w-full z-10 flex flex-col items-center pointer-events-none">
        <h1 className="text-4xl font-bold text-sky-900 bg-white/50 px-6 py-2 rounded-full backdrop-blur-md">
          Panda Village 🐼
        </h1>
        <p className="mt-2 text-sky-800 font-medium">
          Use arrow keys or WASD to move
        </p>
        {/* 낮/밤 상태 표시 */}
        <div
          className={`mt-3 px-4 py-1 rounded-full text-sm font-semibold backdrop-blur-md transition-all duration-1000 ${
            isNight
              ? "bg-indigo-900/60 text-yellow-200"
              : "bg-yellow-100/60 text-orange-700"
          }`}
        >
          {isNight ? "🌙 밤 — 반딧불이가 나왔어요!" : "☀️ 낮 — 꽃잎이 흩날려요!"}
        </div>
      </div>

      <KeyboardControls map={map}>
        <Scene onNightChange={setIsNight}>
          <Ground />
          <Environment />
          <House position={[0, 4.5, -7]} rotation={[0, 0, 0]} scale={5} />
          {/* 낮: 꽃잎 / 밤: 반딧불이 */}
          {isNight ? <FireflyParticles /> : <PetalParticles />}
          <Player />
        </Scene>
      </KeyboardControls>
    </main>
  );
}
