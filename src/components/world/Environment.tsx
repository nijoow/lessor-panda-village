"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// ---------- 나무 (집 scale=5 기준으로 3~4배 크게) ----------
interface TreeProps {
  position: [number, number, number];
  scale?: number;
}

const Tree = ({ position, scale = 1 }: TreeProps) => {
  return (
    <group position={position} scale={scale}>
      {/* 나무 기둥 */}
      <mesh castShadow position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.28, 0.42, 2.4, 8]} />
        <meshStandardMaterial color="#7a5c3a" roughness={0.9} />
      </mesh>
      {/* 잎 레이어 1 (하단) */}
      <mesh castShadow position={[0, 3.2, 0]}>
        <coneGeometry args={[2.0, 2.6, 8]} />
        <meshStandardMaterial color="#4caf63" roughness={0.8} />
      </mesh>
      {/* 잎 레이어 2 (중단) */}
      <mesh castShadow position={[0, 4.7, 0]}>
        <coneGeometry args={[1.5, 2.1, 8]} />
        <meshStandardMaterial color="#56cc72" roughness={0.8} />
      </mesh>
      {/* 잎 레이어 3 (상단) */}
      <mesh castShadow position={[0, 6.0, 0]}>
        <coneGeometry args={[1.0, 1.8, 8]} />
        <meshStandardMaterial color="#69e086" roughness={0.7} />
      </mesh>
    </group>
  );
};

// ---------- 거대 고목 (Ancient Tree) ----------
const AncientTree = ({ position }: { position: [number, number, number] }) => {
  return (
    <group position={position}>
      {/* 거대 나무 기둥 */}
      <mesh castShadow position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.8, 1.2, 5, 12]} />
        <meshStandardMaterial color="#5e4226" roughness={0.9} />
      </mesh>
      {/* 잎사귀 뭉치들 (분홍색 벚꽃 느낌) */}
      <group position={[0, 5, 0]}>
        {/* 중앙 상단 */}
        <mesh castShadow position={[0, 2.5, 0]}>
          <sphereGeometry args={[2.5, 16, 16]} />
          <meshStandardMaterial color="#ffb6c1" roughness={0.8} />
        </mesh>
        {/* 주변 뭉치 1 */}
        <mesh castShadow position={[1.5, 1.2, 1.2]}>
          <sphereGeometry args={[1.8, 12, 12]} />
          <meshStandardMaterial color="#ffc0cb" roughness={0.8} />
        </mesh>
        {/* 주변 뭉치 2 */}
        <mesh castShadow position={[-1.8, 0.8, -1.0]}>
          <sphereGeometry args={[2.0, 12, 12]} />
          <meshStandardMaterial color="#ffb6c1" roughness={0.8} />
        </mesh>
        {/* 주변 뭉치 3 */}
        <mesh castShadow position={[0.5, 0.5, -2.0]}>
          <sphereGeometry args={[1.6, 12, 12]} />
          <meshStandardMaterial color="#ffc0cb" roughness={0.8} />
        </mesh>
        {/* 주변 뭉치 4 */}
        <mesh castShadow position={[-1.2, 1.5, 1.8]}>
          <sphereGeometry args={[1.9, 12, 12]} />
          <meshStandardMaterial color="#f8bbd0" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
};

// ---------- 벤치 (마을 쉼터) ----------
const Bench = ({
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
        <boxGeometry args={[2.2, 0.1, 0.8]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
      {/* 등받이 */}
      <mesh castShadow position={[0, 0.9, -0.35]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[2.2, 0.8, 0.1]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
      {/* 다리 4개 */}
      <mesh position={[-0.9, 0.2, 0.3]}>
        <boxGeometry args={[0.1, 0.4, 0.1]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[0.9, 0.2, 0.3]}>
        <boxGeometry args={[0.1, 0.4, 0.1]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[-0.9, 0.2, -0.3]}>
        <boxGeometry args={[0.1, 0.4, 0.1]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[0.9, 0.2, -0.3]}>
        <boxGeometry args={[0.1, 0.4, 0.1]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
    </group>
  );
};

// ---------- 바위 ----------
interface RockProps {
  position: [number, number, number];
  scale?: [number, number, number];
  rotation?: number;
}

const Rock = ({ position, scale = [2, 1.4, 2], rotation = 0 }: RockProps) => {
  return (
    <mesh
      castShadow
      receiveShadow
      position={position}
      scale={scale}
      rotation={[0, rotation, 0]}
    >
      <dodecahedronGeometry args={[0.5, 0]} />
      <meshStandardMaterial color="#8a8a8a" roughness={0.95} metalness={0.05} />
    </mesh>
  );
};

// ---------- 꽃 ----------
interface FlowerProps {
  position: [number, number, number];
  color: string;
  scale?: number;
}

const Flower = ({ position, color, scale = 1 }: FlowerProps) => {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.3, 5]} />
        <meshStandardMaterial color="#4a7a3a" />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial
          color={color}
          roughness={0.5}
          emissive={color}
          emissiveIntensity={0.15}
        />
      </mesh>
    </group>
  );
};

// ---------- 울타리 (집 주변 용도, 더 크고 두꺼운 버전) ----------
interface FencePostProps {
  position: [number, number, number];
  rotation?: number;
}

const FenceSegment = ({ position, rotation = 0 }: FencePostProps) => {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* 기둥 2개 */}
      <mesh castShadow position={[-1.0, 0.9, 0]}>
        <boxGeometry args={[0.2, 1.8, 0.2]} />
        <meshStandardMaterial color="#c8a96a" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[1.0, 0.9, 0]}>
        <boxGeometry args={[0.2, 1.8, 0.2]} />
        <meshStandardMaterial color="#c8a96a" roughness={0.9} />
      </mesh>
      {/* 가로대 2개 */}
      <mesh castShadow position={[0, 1.4, 0]}>
        <boxGeometry args={[2.0, 0.15, 0.15]} />
        <meshStandardMaterial color="#d4b47a" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 0.6, 0]}>
        <boxGeometry args={[2.0, 0.15, 0.15]} />
        <meshStandardMaterial color="#d4b47a" roughness={0.9} />
      </mesh>
    </group>
  );
};

// ---------- 구름 ----------
const CLOUD_OFFSETS = [0.8, 2.1, 3.7, 5.2, 1.4, 4.6];
let _cloudIdx = 0;

const Cloud = ({
  position,
  speed = 0.002,
}: {
  position: [number, number, number];
  speed?: number;
}) => {
  const ref = useRef<THREE.Group>(null!);
  const offset = useMemo(() => {
    const v = CLOUD_OFFSETS[_cloudIdx % CLOUD_OFFSETS.length];
    _cloudIdx++;
    return v;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.x =
      position[0] + Math.sin(state.clock.elapsedTime * speed + offset) * 4;
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

// ---------- 꽃 데이터 ----------

// 집 주변과 잔디밭에 꽃 배치 (집 영역 0,y,-7 근방 제외)
const FLOWERS: Array<{ pos: [number, number, number]; color: string }> = [
  // 왼쪽 구역
  { pos: [-5, 0, 0], color: "#ff6b8a" },
  { pos: [-6, 0, 2.5], color: "#ffb347" },
  { pos: [-7, 0, -1], color: "#a78bfa" },
  { pos: [-4, 0, 4], color: "#f9ca24" },
  { pos: [-8, 0, 4], color: "#ff99cc" },
  { pos: [-3, 0, 6], color: "#ff6b8a" },
  { pos: [-9, 0, 1], color: "#ffb347" },
  { pos: [-5, 0, 8], color: "#a78bfa" },
  { pos: [-2, 0, 7], color: "#f9ca24" },
  { pos: [-10, 0, 6], color: "#ff99cc" },
  { pos: [-11, 0, 3], color: "#ff6b8a" },
  { pos: [-7, 0, 9], color: "#ffb347" },
  // 오른쪽 구역
  { pos: [5, 0, 0], color: "#a78bfa" },
  { pos: [6, 0, 2.5], color: "#f9ca24" },
  { pos: [7, 0, -1], color: "#ff99cc" },
  { pos: [4, 0, 4], color: "#ff6b8a" },
  { pos: [8, 0, 4], color: "#ffb347" },
  { pos: [3, 0, 6], color: "#a78bfa" },
  { pos: [9, 0, 1], color: "#f9ca24" },
  { pos: [5, 0, 8], color: "#ff99cc" },
  { pos: [2, 0, 7], color: "#ff6b8a" },
  { pos: [10, 0, 6], color: "#ffb347" },
  { pos: [11, 0, 3], color: "#a78bfa" },
  { pos: [7, 0, 9], color: "#f9ca24" },
  // 앞쪽 구역
  { pos: [0, 0, 5], color: "#ff99cc" },
  { pos: [2, 0, 3], color: "#ff6b8a" },
  { pos: [-2, 0, 3], color: "#ffb347" },
  { pos: [4, 0, 7], color: "#a78bfa" },
  { pos: [-4, 0, 7], color: "#f9ca24" },
  { pos: [0, 0, 10], color: "#ff99cc" },
  { pos: [3, 0, 11], color: "#ff6b8a" },
  { pos: [-3, 0, 11], color: "#ffb347" },
  { pos: [6, 0, 12], color: "#a78bfa" },
  { pos: [-6, 0, 12], color: "#f9ca24" },
  // 집 왼쪽
  { pos: [-5, 0, -5], color: "#ff99cc" },
  { pos: [-7, 0, -6], color: "#ff6b8a" },
  { pos: [-9, 0, -4], color: "#ffb347" },
  { pos: [-10, 0, -7], color: "#a78bfa" },
  // 집 오른쪽
  { pos: [5, 0, -5], color: "#f9ca24" },
  { pos: [7, 0, -6], color: "#ff99cc" },
  { pos: [9, 0, -4], color: "#ff6b8a" },
  { pos: [10, 0, -7], color: "#ffb347" },
];

// ---------- 메인 환경 컴포넌트 ----------
export const Environment = () => {
  return (
    <group>
      {/* === 안개 (집 뒤쪽 멀리 흐릿하게) === */}
      <fog attach="fog" args={["#c9e8f5", 35, 80]} />
      {/* === 구름 (높이, 스케일 2배로) === */}
      <Cloud position={[12, 12, -10]} speed={0.0008} />
      <Cloud position={[-18, 14, -12]} speed={0.0006} />
      <Cloud position={[22, 10, 8]} speed={0.001} />
      <Cloud position={[-8, 13, 18]} speed={0.0007} />
      <Cloud position={[5, 11, -18]} speed={0.0009} />
      {/* === 나무 (집 크기 기준으로 scale 1.0~1.6) ===
           집은 y=4.5에 위치, scale=5이므로 집 높이는 약 6~8 유닛
           나무도 비슷한 높이가 되도록 scale 1.0~1.4 */}
      {/* 마을 왼쪽 뒤 */}
      <Tree position={[-10, 0, -10]} scale={1.3} />
      <Tree position={[-14, 0, -6]} scale={1.1} />
      <Tree position={[-13, 0, -13]} scale={1.4} />
      {/* 마을 오른쪽 뒤 */}
      <Tree position={[8, 0, -12]} scale={1.2} />
      <Tree position={[12, 0, -8]} scale={1.0} />
      <Tree position={[13, 0, -13]} scale={1.35} />
      {/* 마을 왼쪽 앞 */}
      <Tree position={[-12, 0, 6]} scale={1.15} />
      <Tree position={[-10, 0, 13]} scale={1.0} />
      {/* 마을 오른쪽 앞 */}
      <Tree position={[14, 0, 7]} scale={1.2} />
      {/* 마을 정면 */}
      <Tree position={[-3, 0, 15]} scale={1.0} />
      <Tree position={[4, 0, 14]} scale={1.15} />

      {/* === 마을 중앙 랜드마크 (Ancient Tree) === */}
      <AncientTree position={[0, 0, 5]} />
      
      {/* === 중앙 화단 및 벤치 === */}
      <Bench position={[4, 0, 5]} rotation={-Math.PI / 2} />
      <Bench position={[-4, 0, 5]} rotation={Math.PI / 2} />
      <Bench position={[0, 0, 9]} rotation={Math.PI} />
      {/* === 바위 (2배 크기) === */}
      <Rock position={[5, 0, 4]} scale={[2.2, 1.5, 2.4]} rotation={0.4} />
      <Rock position={[5.8, 0, 5.5]} scale={[1.4, 1.0, 1.6]} rotation={1.2} />
      <Rock position={[-6, 0, -2]} scale={[2.8, 1.8, 2.4]} rotation={0.8} />
      <Rock position={[9, 0, -3]} scale={[1.6, 1.2, 1.8]} rotation={2.1} />
      <Rock position={[-5, 0, 8]} scale={[2.0, 1.4, 2.0]} rotation={0.3} />
      <Rock position={[0, 0, 12]} scale={[1.8, 1.2, 1.6]} rotation={1.5} />
      {/* === 꽃밭 (scale 1.5로 조금 크게) === */}
      {FLOWERS.map((f, i) => (
        <Flower key={i} position={f.pos} color={f.color} scale={1} />
      ))}
      {/* === 울타리 (집 scale에 맞게 확장 — 울타리 선이 ±17) === */}
      {/* 남쪽 (z=17) */}
      {[-16, -14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8].map((x) => (
        <FenceSegment key={`s${x}`} position={[x, 0, 17]} />
      ))}
      {/* 북쪽 (z=-17) */}
      {[-16, -14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12, 14, 16].map(
        (x) => (
          <FenceSegment key={`n${x}`} position={[x, 0, -17]} />
        ),
      )}
      {/* 서쪽 (x=-17) */}
      {[-16, -14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12, 14, 16].map(
        (z) => (
          <FenceSegment
            key={`w${z}`}
            position={[-17, 0, z]}
            rotation={Math.PI / 2}
          />
        ),
      )}
      {/* 동쪽 (x=17) */}
      {[-16, -14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12, 14, 16].map(
        (z) => (
          <FenceSegment
            key={`e${z}`}
            position={[17, 0, z]}
            rotation={Math.PI / 2}
          />
        ),
      )}
    </group>
  );
};
