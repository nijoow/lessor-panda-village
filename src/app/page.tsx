"use client";

import { KeyboardControls, KeyboardControlsEntry } from "@react-three/drei";
import { Scene } from "@/components/Scene";
import { Ground } from "@/components/world/Ground";
import { Player, Controls } from "@/components/world/Player";
import { Environment } from "@/components/world/Environment";
import { House } from "@/components/world/House";
import { PetalParticles, FireflyParticles } from "@/components/world/Particles";
import { useRef, useState, useEffect } from "react";
import * as THREE from "three";

const keyboardMap: KeyboardControlsEntry<Controls>[] = [
  { name: Controls.forward, keys: ["ArrowUp", "KeyW"] },
  { name: Controls.backward, keys: ["ArrowDown", "KeyS"] },
  { name: Controls.left, keys: ["ArrowLeft", "KeyA"] },
  { name: Controls.right, keys: ["ArrowRight", "KeyD"] },
  { name: Controls.run, keys: ["ShiftLeft", "ShiftRight"] },
  { name: Controls.jump, keys: ["Space"] },
  { name: Controls.interact, keys: ["KeyE"] },
  { name: Controls.nightToggle, keys: ["KeyN"] },
];

export default function Home() {
  const [isNight, setIsNight] = useState(false);
  const playerRef = useRef<THREE.Group>(null!);

  // 1. 자동 낮밤 전환 (45초 주기)
  useEffect(() => {
    const interval = setInterval(() => {
      setIsNight((prev) => !prev);
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  return (
    <KeyboardControls map={keyboardMap}>
      <HomeContent isNight={isNight} setIsNight={setIsNight} playerRef={playerRef} />
    </KeyboardControls>
  );
}

interface HomeContentProps {
  isNight: boolean;
  setIsNight: React.Dispatch<React.SetStateAction<boolean>>;
  playerRef: React.MutableRefObject<THREE.Group>;
}

const HomeContent = ({ isNight, setIsNight, playerRef }: HomeContentProps) => {
  // 2. 수동 전환 감지 (N 키)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyN") {
        setIsNight((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setIsNight]);

  return (
    <main className="w-full h-full relative overflow-hidden">
      {/* UI layer */}
      <div className="absolute top-10 left-0 w-full z-10 flex flex-col items-center pointer-events-none select-none">
        <h1 className="text-4xl font-black text-sky-900 drop-shadow-sm bg-white/40 px-8 py-3 rounded-full backdrop-blur-xl border border-white/20">
          Panda Village 🐼
        </h1>
        <p className="mt-4 text-sky-800 font-bold bg-white/20 px-4 py-1 rounded-full backdrop-blur-md">
          ARROWS/WASD: Move | SPACE: Jump | N: Toggle Day/Night
        </p>
        
        <div
          className={`mt-4 px-6 py-2 rounded-full text-sm font-bold shadow-xl transition-all duration-1000 ${
            isNight
              ? "bg-indigo-950/80 text-yellow-300 ring-2 ring-yellow-400/30"
              : "bg-amber-100/80 text-orange-800 ring-2 ring-orange-500/30"
          }`}
        >
          {isNight ? "🌙 고요한 밤이에요" : "☀️ 화창한 낮이에요"}
        </div>
      </div>

      <Scene isNight={isNight}>
        <Ground />
        <Environment />
        <House position={[0, 4.5, -7]} rotation={[0, 0, 0]} scale={5} />
        {isNight ? <FireflyParticles /> : <PetalParticles />}
        
        {/* Player */}
        <Player ref={playerRef} />
      </Scene>
    </main>
  );
};
