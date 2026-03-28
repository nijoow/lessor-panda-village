"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Sky,
  Stars,
} from "@react-three/drei";
import { ReactNode, useRef, useState } from "react";
import * as THREE from "three";

// ──────────────────────────────────────────────────
// 낮/밤 전환 주기 (초 단위, 60초 = 낮 30 + 밤 30)
// ──────────────────────────────────────────────────
const DAY_NIGHT_CYCLE = 60;

interface DayNightLightsProps {
  onNightChange: (isNight: boolean) => void;
}

const DayNightLights = ({ onNightChange }: DayNightLightsProps) => {
  const dirLightRef = useRef<THREE.DirectionalLight>(null!);
  const ambLightRef = useRef<THREE.AmbientLight>(null!);
  const isNightRef = useRef(false);

  useFrame((state) => {
    const t = (state.clock.elapsedTime % DAY_NIGHT_CYCLE) / DAY_NIGHT_CYCLE;
    // t: 0=정오, 0.5=자정

    // 태양 위치: 반원 궤도
    const angle = t * Math.PI * 2 - Math.PI / 2;
    const sunY = Math.sin(angle) * 25;
    const sunX = Math.cos(angle) * 25;

    if (dirLightRef.current) {
      dirLightRef.current.position.set(sunX, sunY, 10);

      // 낮: 강한 흰빛, 밤: 약한 파란빛
      const dayBlend = Math.max(0, Math.sin(angle)); // 0(밤) ~ 1(낮)
      const nightBlend = 1 - dayBlend;

      dirLightRef.current.intensity = dayBlend * 2.5 + nightBlend * 0.4;
      dirLightRef.current.color.setRGB(
        0.9 + dayBlend * 0.1,
        0.85 + dayBlend * 0.15,
        0.7 + dayBlend * 0.3,
      );
    }

    if (ambLightRef.current) {
      const dayBlend = Math.max(0, Math.sin(angle));
      ambLightRef.current.intensity = dayBlend * 0.8 + (1 - dayBlend) * 0.25;
      ambLightRef.current.color.setRGB(
        0.7 + dayBlend * 0.3,
        0.75 + dayBlend * 0.25,
        0.9 + dayBlend * 0.1,
      );
    }

    // 밤 여부 판단 (태양이 지평선 아래)
    const nowNight = sunY < 0;
    if (nowNight !== isNightRef.current) {
      isNightRef.current = nowNight;
      onNightChange(nowNight);
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
const DynamicSky = () => {
  const skyRef = useRef<{ sunPosition: THREE.Vector3 } | null>(null);

  useFrame((state) => {
    const t = (state.clock.elapsedTime % DAY_NIGHT_CYCLE) / DAY_NIGHT_CYCLE;
    const angle = t * Math.PI * 2 - Math.PI / 2;
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle);

    if (skyRef.current) {
      // @ts-expect-error drei Sky uniform
      skyRef.current.material.uniforms.sunPosition.value.set(
        sunX * 10,
        sunY * 5,
        8,
      );
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
  onNightChange?: (isNight: boolean) => void;
}

export const Scene = ({ children, onNightChange }: Props) => {
  return (
    <Canvas shadows>
      {/* 
        1. PerspectiveCamera: 원근감 카메라
      */}
      <PerspectiveCamera makeDefault position={[14, 14, 14]} fov={40} />

      {/* 
        2. OrbitControls: 마우스 드래그로 씬 관찰
      */}
      <OrbitControls makeDefault />

      {/* 
        3. 다이나믹 하늘 + 낮/밤 조명
      */}
      <DynamicSky />
      <Stars radius={80} depth={50} count={4000} factor={3} fade speed={0.5} />
      <DayNightLights onNightChange={onNightChange ?? (() => {})} />

      {children}
    </Canvas>
  );
};
