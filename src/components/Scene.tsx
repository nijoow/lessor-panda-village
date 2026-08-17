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
  Environment as EnvironmentMap,
  Lightformer,
} from "@react-three/drei";
import { EffectComposer, Bloom, SMAA } from "@react-three/postprocessing";
import { ReactNode, useMemo, useRef, Suspense } from "react";
import * as THREE from "three";
import { frameLerp } from "@/utils/math";
import { useZoneStore } from "@/stores/zoneStore";

// ──────────────────────────────────────────────────
// 낮/밤 사이클 (태양 진행도 하나로 조명 + 하늘을 함께 갱신)
// ──────────────────────────────────────────────────
interface SkyImpl {
  material: { uniforms: { sunPosition: { value: THREE.Vector3 } } };
}

// 거리 안개. 깊이를 만들되 화면을 뿌옇게 만들지는 않아야 한다.
//
// fogExp2의 감쇠는 1 - exp(-(density × 거리)²)라 거리에 제곱으로 붙는다.
// 카메라를 최대(40)로 당기면 캐릭터까지가 이미 40 유닛이므로, 이 지점에서
// 몇 %가 끼는지가 체감 화질을 좌우한다. 0.0085에서는 40 유닛에 11%가 껴서
// 줌아웃할 때마다 화면이 뿌옇게 보였다.
//
//   density   20유닛   40유닛   100유닛
//   0.0085     2.8%    10.9%     42%
//   0.005      1.0%     3.9%     22%
//
// 경계를 감추는 일은 경계 숲(wilds.ts)이 직접 하므로 안개가 짙을 이유가
// 없다. 가까이는 거의 투명하고 먼 배경만 물드는 값으로 잡는다.
const FOG_DENSITY_DAY = 0.005;
const FOG_DENSITY_NIGHT = 0.0065;

// 그림자맵 갱신 임계값. 이보다 작은 변화는 2048 그림자맵에서 한 텍셀도
// 움직이지 않으므로 다시 그릴 이유가 없다.
const SHADOW_MOVE_EPS = 0.02; // 월드 유닛 / 라디안
const SHADOW_SUN_EPS = 0.0005; // 태양 진행도(0~1)

const DayNightCycle = ({ isNight }: { isNight: boolean }) => {
  const dirLightRef = useRef<THREE.DirectionalLight>(null!);
  const ambLightRef = useRef<THREE.AmbientLight>(null!);
  const skyRef = useRef<SkyImpl | null>(null);
  const fogRef = useRef<THREE.FogExp2>(null!);
  const sunProgress = useRef(0);
  // 그림자 카메라(±30)가 플레이어를 따라다니도록 라이트 타깃을 이동
  const lightTarget = useMemo(() => new THREE.Object3D(), []);

  // 그림자맵을 마지막으로 그렸을 때의 캐스터 상태
  const shadowAnchor = useRef({ x: Infinity, z: 0, ry: 0, sun: -1 });

  useFrame((state, delta) => {
    // 이 월드에서 움직이는 그림자 캐스터는 플레이어와 해뿐이고 나머지는
    // 전부 정적이다(원격 플레이어는 가짜 원형 그림자를 쓴다). 그런데도
    // three는 기본적으로 매 프레임 그림자맵을 다시 그린다 — 서 있기만 해도
    // 100만 삼각형이 넘는 그림자 패스를 60번씩 반복하게 된다.
    // 아래에서 캐스터가 움직인 프레임에만 직접 needsUpdate를 올린다.
    if (state.gl.shadowMap.autoUpdate) {
      state.gl.shadowMap.autoUpdate = false;
    }

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
      const p = useZoneStore.getState().playerPos;
      dirLightRef.current.position.set(
        p.x + sunX * 30,
        Math.max(sunY * 30, 8),
        p.z + 15,
      );
      if (dirLightRef.current.target !== lightTarget) {
        dirLightRef.current.target = lightTarget;
      }
      lightTarget.position.set(p.x, 0, p.z);
      lightTarget.updateMatrixWorld();

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
      // 환경맵이 간접광을 담당하므로 앰비언트는 낮춰 잡는다
      ambLightRef.current.intensity =
        dayIntensity * 0.62 + (1 - dayIntensity) * 0.25;
      ambLightRef.current.color.setRGB(
        0.8 + dayIntensity * 0.2,
        0.85 + dayIntensity * 0.15,
        1.0,
      );
    }

    // 안개도 하늘과 같은 진행도로 함께 물든다
    if (fogRef.current) {
      fogRef.current.color.setRGB(
        0.06 + dayIntensity * 0.72,
        0.08 + dayIntensity * 0.77,
        0.16 + dayIntensity * 0.76,
      );
      fogRef.current.density =
        FOG_DENSITY_NIGHT +
        (FOG_DENSITY_DAY - FOG_DENSITY_NIGHT) * dayIntensity;
    }

    skyRef.current?.material.uniforms.sunPosition.value.set(
      sunX * 20,
      sunY * 20,
      15,
    );

    // 캐스터가 실제로 움직인 프레임에만 그림자맵을 다시 그린다.
    // 걷기·회전은 위치로, 제자리 이모트는 playerPose로, 낮밤 전환 중의
    // 해 이동은 진행도로 잡는다. 그 외에는 직전 그림자맵을 그대로 쓴다.
    const anchor = shadowAnchor.current;
    const { playerPos, playerPose } = useZoneStore.getState();
    if (
      playerPose.emoting ||
      Math.abs(playerPos.x - anchor.x) > SHADOW_MOVE_EPS ||
      Math.abs(playerPos.z - anchor.z) > SHADOW_MOVE_EPS ||
      Math.abs(playerPos.ry - anchor.ry) > SHADOW_MOVE_EPS ||
      Math.abs(sunProgress.current - anchor.sun) > SHADOW_SUN_EPS
    ) {
      anchor.x = playerPos.x;
      anchor.z = playerPos.z;
      anchor.ry = playerPos.ry;
      anchor.sun = sunProgress.current;
      state.gl.shadowMap.needsUpdate = true;
    }
  });

  return (
    <>
      <fogExp2 ref={fogRef} attach="fog" args={["#c7dcea", FOG_DENSITY_DAY]} />
      <ambientLight ref={ambLightRef} intensity={1.0} />
      <primitive object={lightTarget} />
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
        shadow-bias={-0.0004}
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
// 절차적 환경맵
//
// 표준 재질(PBR)은 환경맵이 없으면 간접광과 반사가 전혀 없어 조명을 올려도
// 플라스틱처럼 보인다. drei의 preset은 CDN에서 HDR을 받아오므로, 외부 의존
// 없이 하늘·지면·해를 직접 그려 작은 큐브맵으로 굽는다.
//
// frames={1}이라 한 번만 굽는다. 낮밤이 바뀌면 children이 바뀌므로 drei가
// 같은 큐브 타깃에 다시 구워 준다(three가 pmremVersion으로 갱신을 감지한다).
// key로 리마운트하면 60초마다 큐브 렌더 타깃을 새로 할당·해제하게 된다.
// ──────────────────────────────────────────────────
const StylizedEnvironment = ({ isNight }: { isNight: boolean }) => (
  <EnvironmentMap resolution={64} frames={1}>
    {/* 하늘 */}
    <mesh scale={100}>
      <sphereGeometry args={[1, 24, 16]} />
      <meshBasicMaterial
        color={isNight ? "#1b2442" : "#a8cbe6"}
        side={THREE.BackSide}
      />
    </mesh>
    {/* 지면 반사광 — 아래에서 올라오는 잔디 톤 */}
    <mesh scale={100} rotation={[-Math.PI / 2, 0, 0]} position={[0, -30, 0]}>
      <circleGeometry args={[1, 24]} />
      <meshBasicMaterial color={isNight ? "#151d2e" : "#7f9e63"} />
    </mesh>
    {/* 해 / 달 */}
    <Lightformer
      form="circle"
      intensity={isNight ? 0.6 : 3}
      color={isNight ? "#9fb6ff" : "#fff4e0"}
      position={[10, 12, 8]}
      scale={12}
    />
    {/* 반대편 채움광 */}
    <Lightformer
      form="rect"
      intensity={isNight ? 0.25 : 1}
      color={isNight ? "#6b7bb0" : "#cfe4f5"}
      position={[-14, 8, -10]}
      scale={[20, 14, 1]}
    />
  </EnvironmentMap>
);

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
      <StylizedEnvironment isNight={isNight} />
      {/* count를 바꾸면 geometry가 재생성되므로 visible 토글로 처리 */}
      <group visible={isNight}>
        <Stars radius={80} depth={50} count={4000} factor={3} fade speed={0.5} />
      </group>

      <Suspense fallback={null}>{children}</Suspense>

      {/* multisampling 기본값 8은 화면 크기 × 8배짜리 HalfFloat 렌더 타깃을
          잡는다(1080p·dpr 1.5에서 약 300MB). 0으로 끄면 SMAA만 남아 화면이
          뿌옇게 물러지므로, 눈에 띄는 차이 없이 비용만 절반인 4로 둔다. */}
      <EffectComposer multisampling={4}>
        {/* 밤 임계값이 낮으면 장면 전체가 번져 석등·게시판 불빛이 묻힌다.
            빛나야 할 것만 빛나도록 임계값을 올리고 강도를 낮춘다. */}
        <Bloom
          luminanceThreshold={isNight ? 0.45 : 0.8}
          mipmapBlur
          intensity={isNight ? 1.0 : 0.35}
          radius={0.5}
        />
        {/* gl의 MSAA는 후처리 파이프라인에서 동작하지 않으므로 SMAA로 처리.
            계단현상은 품질이 낮아 보이는 가장 흔한 원인이다. */}
        <SMAA />
      </EffectComposer>

      <Preload all />
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
    </Canvas>
  );
};
