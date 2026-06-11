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
import { frameLerp } from "@/utils/math";

// ──────────────────────────────────────────────────
// 낮/밤 사이클 (태양 진행도 하나로 조명 + 하늘을 함께 갱신)
// ──────────────────────────────────────────────────
interface SkyImpl {
  material: { uniforms: { sunPosition: { value: THREE.Vector3 } } };
}

const DayNightCycle = ({ isNight }: { isNight: boolean }) => {
  const dirLightRef = useRef<THREE.DirectionalLight>(null!);
  const ambLightRef = useRef<THREE.AmbientLight>(null!);
  const skyRef = useRef<SkyImpl | null>(null);
  const sunProgress = useRef(0);

  useFrame((_state, delta) => {
    // isNight 상태에 따라 sunProgress (0: 밤, 1: 낮)를 부드럽게 보간
    const targetProgress = isNight ? 0 : 1;
    sunProgress.current = THREE.MathUtils.lerp(
      sunProgress.current,
      targetProgress,
      frameLerp(0.015, Math.min(delta, 0.1)),
    );

    // angle 계산 (낮=PI/2, 밤=-PI/2)
    const angle = (sunProgress.current - 0.5) * Math.PI;
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle);
    const dayIntensity = Math.max(0, sunY);

    if (dirLightRef.current) {
      dirLightRef.current.position.set(sunX * 30, sunY * 30, 15);

      // 낮에는 강한 빛, 밤에는 은은한 푸른빛
      dirLightRef.current.intensity =
        dayIntensity * 2.8 + (1 - dayIntensity) * 0.5;

      if (dayIntensity > 0.1) {
        dirLightRef.current.color.setRGB(1, 0.95, 0.86); // 따뜻한 햇살
      } else {
        dirLightRef.current.color.setRGB(0.6, 0.7, 1.0); // 차가운 달빛
      }
    }

    if (ambLightRef.current) {
      ambLightRef.current.intensity =
        dayIntensity * 0.9 + (1 - dayIntensity) * 0.35;
      ambLightRef.current.color.setRGB(
        0.8 + dayIntensity * 0.2,
        0.85 + dayIntensity * 0.15,
        1.0,
      );
    }

    skyRef.current?.material.uniforms.sunPosition.value.set(
      sunX * 20,
      sunY * 20,
      15,
    );
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
      <Sky
        // @ts-expect-error drei Sky가 ref 타입을 노출하지 않음
        ref={skyRef}
        distance={450}
        sunPosition={[10, 5, 8]}
        inclination={0.52}
        azimuth={0.25}
        turbidity={6}
        rayleigh={0.5}
      />
    </>
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
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      onContextMenu={(e) => e.preventDefault()}
      dpr={[1, 1.5]} // 성능을 위해 최대 dpr 제한 (High TBT 대응)
      gl={{
        powerPreference: "high-performance",
        antialias: false, // 성능 최적화
        stencil: false,
        depth: true,
      }}
    >
      <PerspectiveCamera makeDefault position={[18, 18, 18]} fov={35} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={20}
        maxDistance={40}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.5}
      />

      <DayNightCycle isNight={isNight} />
      {/* count를 바꾸면 geometry가 재생성되므로 visible 토글로 처리 */}
      <group visible={isNight}>
        <Stars radius={80} depth={50} count={4000} factor={3} fade speed={0.5} />
      </group>

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
