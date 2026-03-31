"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Sky,
  Stars,
  Preload,
  AdaptiveDpr,
  AdaptiveEvents,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { ReactNode, useRef, Suspense } from "react";
import * as THREE from "three";

const DayNightLights = () => {
  const dirLightRef = useRef<THREE.DirectionalLight>(null!);
  const ambLightRef = useRef<THREE.AmbientLight>(null!);

  useFrame((state) => {
    // 60초 주기로 한 바퀴 순환 (현실감 있게 연속적으로 변화)
    const cycleTime = 60;
    const t = (state.clock.elapsedTime % cycleTime) / cycleTime;

    // t=0.25 (15초): 정오 (angle = PI/2)
    // t=0.75 (45초): 자정 (angle = -PI/2 또는 3PI/2)
    // t=0 / t=0.5: 일출/일몰 (angle = 0 / PI)
    const angle = Math.PI - t * 2 * Math.PI;

    const sunY = Math.sin(angle) * 30;
    const sunX = Math.cos(angle) * 30;

    if (dirLightRef.current) {
      dirLightRef.current.position.set(sunX, sunY, 15);

      const dayIntensity = Math.max(0, Math.sin(angle)); // 해가 떠있을 때 (0 ~ PI)
      const nightIntensity = Math.max(0, Math.sin(angle + Math.PI)); // 달이 떠있을 때 (PI ~ 2PI)

      // 낮에는 강한 빛, 밤에는 은은한 푸른빛
      dirLightRef.current.intensity = dayIntensity * 2.8 + nightIntensity * 0.5;

      if (dayIntensity > 0) {
        dirLightRef.current.color.setRGB(1, 0.95, 0.86); // 따뜻한 햇살
      } else {
        dirLightRef.current.color.setRGB(0.6, 0.7, 1.0); // 차가운 달빛
      }
    }

    if (ambLightRef.current) {
      const dayIntensity = Math.max(0, Math.sin(angle));
      ambLightRef.current.intensity =
        dayIntensity * 0.9 + (1 - dayIntensity) * 0.35;
      ambLightRef.current.color.setRGB(
        0.8 + dayIntensity * 0.2,
        0.85 + dayIntensity * 0.15,
        1.0,
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
        shadow-mapSize={[1024, 1024]}
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
    const cycleTime = 60;
    const t = (state.clock.elapsedTime % cycleTime) / cycleTime;
    const angle = Math.PI - t * 2 * Math.PI;

    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle);

    if (skyRef.current) {
      // @ts-expect-error drei Sky uniform
      skyRef.current.material.uniforms.sunPosition.value.set(
        sunX * 20,
        sunY * 20,
        15,
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
interface SceneProps {
  children: ReactNode;
  isNight: boolean;
}

export const Scene = ({ children, isNight }: SceneProps) => {
  return (
    <Canvas shadows={{ type: THREE.PCFShadowMap }}>
      <PerspectiveCamera makeDefault position={[18, 18, 18]} fov={35} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={20}
        maxDistance={40}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.5}
      />

      <DynamicSky />
      <Stars
        radius={80}
        depth={50}
        count={isNight ? 4000 : 0}
        factor={3}
        fade
        speed={0.5}
      />
      <DayNightLights />

      <Suspense fallback={null}>{children}</Suspense>

      <EffectComposer>
        <Bloom
          luminanceThreshold={isNight ? 0.2 : 0.8}
          mipmapBlur
          intensity={isNight ? 1.5 : 0.4}
          radius={0.4}
        />
      </EffectComposer>

      <Preload all />
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
    </Canvas>
  );
};
