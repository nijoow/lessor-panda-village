"use client";

import assets from "@/constants/assets.json";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Text } from "@react-three/drei";
import { useCameraOccluder } from "@/hooks/useCameraOccluder";
import { BENCH_SPEC } from "@/constants/world/objects";
import {
  BridgePlacement,
  LandmarkTreePlacement,
  SignPlacement,
} from "@/constants/world";
import { createRockGeometry } from "./geometry";

// ---------- 거대 고목 (Ancient Tree - 제공된 GLB 모델) ----------
export const AncientTree = ({
  placement,
}: {
  placement: LandmarkTreePlacement;
}) => {
  const { scene } = useGLTF(assets.scenery.tree.url);

  const treeModel = useCameraOccluder(
    scene,
    `${placement.x},${placement.y},${placement.z}:${placement.rotation}:${placement.scale}`,
  );

  return (
    <primitive
      object={treeModel}
      dispose={null}
      position={[placement.x, placement.y, placement.z]}
      scale={placement.scale}
      rotation={[0, placement.rotation, 0]}
    />
  );
};

// ---------- 벤치 (마을 쉼터) ----------
export const Bench = ({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) => {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* 앉는 판 */}
      <mesh castShadow position={[0, 0.45, 0]}>
        <boxGeometry args={[BENCH_SPEC.width, 0.1, BENCH_SPEC.depth]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
      {/* 등받이 */}
      <mesh castShadow position={[0, 0.9, -0.35]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[BENCH_SPEC.width, 0.8, 0.1]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
      {/* 다리 4개 */}
      {(
        [
          [-0.9, 0.3],
          [0.9, 0.3],
          [-0.9, -0.3],
          [0.9, -0.3],
        ] as const
      ).map(([lx, lz]) => (
        <mesh key={`${lx}-${lz}`} position={[lx, 0.2, lz]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial color="#5d4037" />
        </mesh>
      ))}
    </group>
  );
};

// ---------- 바위 ----------
// 19개가 전부 같은 형상을 쓰므로 모듈에서 한 번만 만든다
const ROCK_GEOMETRY = createRockGeometry();

interface RockProps {
  position: [number, number, number];
  scale?: [number, number, number];
  rotation?: number;
}

export const Rock = ({
  position,
  scale = [2, 1.4, 2],
  rotation = 0,
}: RockProps) => {
  return (
    <mesh
      castShadow
      receiveShadow
      position={position}
      scale={scale}
      rotation={[0, rotation, 0]}
    >
      <primitive object={ROCK_GEOMETRY} attach="geometry" />
      <meshStandardMaterial color="#8a8a8a" roughness={0.95} metalness={0.05} />
    </mesh>
  );
};

// ---------- 구름 ----------
export const Cloud = ({
  position,
  speed = 0.002,
  seed = 0,
}: {
  position: [number, number, number];
  speed?: number;
  seed?: number;
}) => {
  const ref = useRef<THREE.Group>(null!);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.x =
      position[0] + Math.sin(state.clock.elapsedTime * speed + seed) * 4;
  });

  return (
    <group ref={ref} position={position} scale={2.2}>
      <mesh>
        <sphereGeometry args={[0.8, 10, 8]} />
        <meshStandardMaterial color="white" roughness={1} />
      </mesh>
      <mesh position={[0.9, 0, 0]}>
        <sphereGeometry args={[0.6, 10, 8]} />
        <meshStandardMaterial color="white" roughness={1} />
      </mesh>
      <mesh position={[-0.9, 0, 0]}>
        <sphereGeometry args={[0.55, 10, 8]} />
        <meshStandardMaterial color="white" roughness={1} />
      </mesh>
      <mesh position={[0.4, 0.4, 0]}>
        <sphereGeometry args={[0.5, 10, 8]} />
        <meshStandardMaterial color="white" roughness={1} />
      </mesh>
    </group>
  );
};

// ---------- 나무 표지판 ----------
export const Signpost = ({ sign }: { sign: SignPlacement }) => (
  <group position={[sign.x, 0, sign.z]} rotation={[0, sign.rotation, 0]}>
    {/* 기둥 — 반경(0.1)이 판 두께의 절반보다 커서 판 앞으로 뚫고 나오면
        글자를 가린다. 판 뒤쪽으로 물려 세운다. */}
    <mesh castShadow position={[0, 0.8, -0.08]}>
      <cylinderGeometry args={[0.08, 0.1, 1.6, 6]} />
      <meshStandardMaterial color="#8d6e63" roughness={0.9} />
    </mesh>
    {/* 팻말 */}
    <mesh castShadow position={[0, 1.35, 0]}>
      <boxGeometry args={[1.5, 0.55, 0.1]} />
      <meshStandardMaterial color="#a1887f" roughness={0.85} />
    </mesh>
    {/* 밤에는 판까지 어두워져 짙은 글자가 묻힌다. 밝은 아웃라인이
        낮/밤 양쪽에서 대비를 만들어 준다 (게시판 현판과 같은 방식). */}
    <Text
      position={[0, 1.35, 0.06]}
      font="/fonts/Jua-Regular.ttf"
      fontSize={0.3}
      color="#4e342e"
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.014}
      outlineColor="#f6e7d2"
    >
      {sign.label}
    </Text>
  </group>
);

// ---------- 나무다리 (개울 도하 지점) ----------
export const Bridge = ({ bridge }: { bridge: BridgePlacement }) => {
  const plankCount = Math.floor(bridge.length / 0.62);
  return (
    <group
      position={[bridge.x, 0, bridge.z]}
      rotation={[0, bridge.rotation, 0]}
    >
      {/* 상판 널빤지 (길이 방향 = x축) */}
      {Array.from({ length: plankCount }, (_, i) => {
        const px =
          -bridge.length / 2 + (i + 0.5) * (bridge.length / plankCount);
        return (
          <mesh key={i} castShadow receiveShadow position={[px, 0.18, 0]}>
            <boxGeometry args={[0.52, 0.1, bridge.width]} />
            <meshStandardMaterial
              color={i % 2 ? "#9a6f4b" : "#8d6543"}
              roughness={0.9}
            />
          </mesh>
        );
      })}
      {/* 아치 보 (양측) */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          castShadow
          position={[0, 0.08, (side * bridge.width) / 2]}
        >
          <boxGeometry args={[bridge.length, 0.14, 0.16]} />
          <meshStandardMaterial color="#7a5638" roughness={0.9} />
        </mesh>
      ))}
      {/* 난간 기둥 + 가로대 */}
      {([-1, 1] as const).map((side) =>
        [-0.42, 0, 0.42].map((t) => (
          <mesh
            key={`${side}-${t}`}
            castShadow
            position={[t * bridge.length, 0.55, (side * bridge.width) / 2]}
          >
            <boxGeometry args={[0.12, 0.75, 0.12]} />
            <meshStandardMaterial color="#7a5638" roughness={0.9} />
          </mesh>
        )),
      )}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={`rail-${side}`}
          castShadow
          position={[0, 0.85, (side * bridge.width) / 2]}
        >
          <boxGeometry args={[bridge.length * 0.92, 0.09, 0.09]} />
          <meshStandardMaterial color="#8d6543" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
};

// ---------- 석등 (Lantern/Toro - 밤에 빛남) ----------
// 실광원(pointLight) 대신 발광 재질(블룸이 후광 처리) + 바닥 글로우 풀.
// 라이트 수가 전체 셰이더 비용을 곱하고 낮밤 전환 시 재컴파일 히치를
// 만들던 문제(H2)의 해결이자, 동숲식 아늑한 웅덩이 빛 연출.
let glowTexture: THREE.CanvasTexture | null = null;

const getGlowTexture = () => {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(255,180,90,0.85)");
  g.addColorStop(0.4, "rgba(255,150,60,0.35)");
  g.addColorStop(1, "rgba(255,140,40,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
};

export const Lantern = ({
  position,
  isNight = false,
}: {
  position: [number, number, number];
  isNight?: boolean;
}) => {
  const glow = useMemo(() => getGlowTexture(), []);
  return (
    <group position={position}>
      {/* 받침대 */}
      <mesh castShadow position={[0, 0.4, 0]}>
        <boxGeometry args={[0.5, 0.8, 0.5]} />
        <meshStandardMaterial color="#757575" roughness={0.9} />
      </mesh>
      {/* 중간 기둥 */}
      <mesh castShadow position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 1.0, 6]} />
        <meshStandardMaterial color="#757575" roughness={0.9} />
      </mesh>
      {/* 전등갓 (하단) */}
      <mesh castShadow position={[0, 1.9, 0]}>
        <cylinderGeometry args={[0.5, 0.4, 0.2, 6]} />
        <meshStandardMaterial color="#757575" roughness={0.9} />
      </mesh>
      {/* 전등 (빛이 나오는 곳 — 블룸이 후광을 만듦) */}
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[0.3, 0.4, 0.3]} />
        <meshStandardMaterial
          color={isNight ? "#ffcc80" : "#eeeeee"}
          emissive={isNight ? "#ff9800" : "#000000"}
          emissiveIntensity={isNight ? 8 : 0}
        />
      </mesh>
      {/* 바닥 글로우 풀 (밤 전용) */}
      {isNight && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
          <circleGeometry args={[3.4, 24]} />
          <meshBasicMaterial
            map={glow}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
      {/* 지붕 */}
      <mesh castShadow position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.1, 0.6, 0.3, 6]} />
        <meshStandardMaterial color="#616161" roughness={0.8} />
      </mesh>
    </group>
  );
};

useGLTF.preload(assets.scenery.tree.url);
