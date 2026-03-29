"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Sky,
  Stars,
} from "@react-three/drei";
import { ReactNode, useRef } from "react";
import * as THREE from "three";

interface DayNightLightsProps {
  isNight: boolean;
}

const DayNightLights = ({ isNight }: DayNightLightsProps) => {
  const dirLightRef = useRef<THREE.DirectionalLight>(null!);
  const ambLightRef = useRef<THREE.AmbientLight>(null!);
  const currentT = useRef(0);

  useFrame((state, delta) => {
    // 0 = 정오(Day), 0.5 = 자정(Night)
    // t=0일 때 angle = PI/2 (해/달이 머리 위에 있음)
    // t=0.5일 때 angle = -PI/2 (해/달이 지평선 아래에 있음)
    const targetT = isNight ? 0.5 : 0;
    
    currentT.current = THREE.MathUtils.lerp(currentT.current, targetT, delta * 2);
    const t = currentT.current;
    
    // t=0 (낮): PI/2, t=0.5 (밤): -PI/2
    const angle = Math.PI / 2 - t * 2 * Math.PI;
    const sunY = Math.sin(angle) * 25;
    const sunX = Math.cos(angle) * 25;

    if (dirLightRef.current) {
      dirLightRef.current.position.set(sunX, sunY, 10);
      const dayBlend = Math.max(0, Math.sin(angle));
      const nightBlend = 1 - dayBlend;
      dirLightRef.current.intensity = dayBlend * 2.5 + nightBlend * 0.4;
      dirLightRef.current.color.setRGB(
        0.9 + dayBlend * 0.1,
        0.85 + dayBlend * 0.15,
        0.7 + dayBlend * 0.3
      );
    }

    if (ambLightRef.current) {
      const dayBlend = Math.max(0, Math.sin(angle));
      ambLightRef.current.intensity = dayBlend * 0.8 + (1 - dayBlend) * 0.25;
      ambLightRef.current.color.setRGB(
        0.7 + dayBlend * 0.3,
        0.75 + dayBlend * 0.25,
        0.9 + dayBlend * 0.1
      );
    }
  });

  return (
    <>
      <ambientLight ref={ambLightRef} intensity={1.0} />
      <directionalLight
        ref={dirLightRef}
        position={[10, 20, 10]}
        intensity={2.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
    </>
  );
};

// ──────────────────────────────────────────────────
// 다이나믹 Sky (낮/밤 전환)
// ──────────────────────────────────────────────────
const DynamicSky = ({ isNight }: { isNight: boolean }) => {
  const skyRef = useRef<{ sunPosition: THREE.Vector3 } | null>(null);
  const currentSunPosition = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const targetT = isNight ? 0.5 : 0;
    const angle = Math.PI / 2 - targetT * 2 * Math.PI;
    const targetSunY = Math.sin(angle);
    const targetSunX = Math.cos(angle);

    const targetPos = new THREE.Vector3(targetSunX * 20, targetSunY * 20, 10);
    currentSunPosition.current.lerp(targetPos, delta * 2);

    if (skyRef.current) {
      // @ts-expect-error drei Sky uniform
      skyRef.current.material.uniforms.sunPosition.value.copy(currentSunPosition.current);
    }
  });

  return (
    <Sky
      // @ts-expect-error ref type
      ref={skyRef}
      distance={450}
      sunPosition={[10, 5, 8]}
      inclination={0.52}
      azimuth={0.25}
      turbidity={6}
      rayleigh={0.5}
    />
  );
};

// ──────────────────────────────────────────────────
// 메인 Scene 컴포넌트
// ──────────────────────────────────────────────────
interface Props {
  children: ReactNode;
  isNight: boolean;
}

export const Scene = ({ children, isNight }: Props) => {
  return (
    <Canvas shadows>
      <PerspectiveCamera makeDefault position={[18, 18, 18]} fov={35} />
      <OrbitControls 
        makeDefault 
        enablePan={false}
        minDistance={20}
        maxDistance={40}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.5}
      />
      
      <DynamicSky isNight={isNight} />
      <Stars radius={80} depth={50} count={isNight ? 4000 : 0} factor={3} fade speed={0.5} />
      <DayNightLights isNight={isNight} />

      {children}
    </Canvas>
  );
};
