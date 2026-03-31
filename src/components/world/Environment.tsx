"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Instances, Instance } from "@react-three/drei";
import { Pond } from "./Pond";

// ---------- 나무 (집 scale=5 기준으로 3~4배 크게) ----------



// ---------- 거대 고목 (Ancient Tree - 제공된 GLB 모델) ----------
const AncientTree = ({ position }: { position: [number, number, number] }) => {
  const { scene } = useGLTF("/models/tree/cherry_blossom_tree.glb");

  // 그림자 설정 및 최적화
  const treeModel = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return (
    <primitive
      object={treeModel}
      position={position}
      scale={4.2}
      rotation={[0, Math.PI / 4, 0]}
    />
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

// ---------- 석등 (Lantern/Toro - 밤에 빛남) ----------
export const Lantern = ({
  position,
  isNight = false,
}: {
  position: [number, number, number];
  isNight?: boolean;
}) => {
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
      {/* 전등 (빛이 나오는 곳) */}
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[0.3, 0.4, 0.3]} />
        <meshStandardMaterial
          color={isNight ? "#ffcc80" : "#eeeeee"}
          emissive={isNight ? "#ff9800" : "#000000"}
          emissiveIntensity={isNight ? 8 : 0}
        />
        {isNight && <pointLight color="#ff8800" intensity={15} distance={10} />}
      </mesh>
      {/* 지붕 */}
      <mesh castShadow position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.1, 0.6, 0.3, 6]} />
        <meshStandardMaterial color="#616161" roughness={0.8} />
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
// ---------- 메인 환경 컴포넌트 (최적화 버전) ----------
export const Environment = ({ isNight = false }: { isNight?: boolean }) => {
  // 인스턴스용 공통 지오메트리 & 마테리얼 생성
  const { treeGeoms, flowerGeoms, fenceGeoms, treeMats, flowerMats, fenceMats } =
    useMemo(() => {
      return {
        treeGeoms: {
          trunk: new THREE.CylinderGeometry(0.28, 0.42, 2.4, 8),
          leaf1: new THREE.ConeGeometry(2.0, 2.6, 8),
          leaf2: new THREE.ConeGeometry(1.5, 2.1, 8),
          leaf3: new THREE.ConeGeometry(1.0, 1.8, 8),
        },
        flowerGeoms: {
          stem: new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5),
          head: new THREE.SphereGeometry(0.12, 8, 8),
        },
        fenceGeoms: {
          post: new THREE.BoxGeometry(0.2, 1.8, 0.2),
          rail: new THREE.BoxGeometry(2.0, 0.15, 0.15),
        },
        treeMats: {
          trunk: new THREE.MeshStandardMaterial({
            color: "#7a5c3a",
            roughness: 0.9,
          }),
          leaf1: new THREE.MeshStandardMaterial({
            color: "#4caf63",
            roughness: 0.8,
          }),
          leaf2: new THREE.MeshStandardMaterial({
            color: "#56cc72",
            roughness: 0.8,
          }),
          leaf3: new THREE.MeshStandardMaterial({
            color: "#69e086",
            roughness: 0.7,
          }),
        },
        flowerMats: {
          stem: new THREE.MeshStandardMaterial({ color: "#4a7a3a" }),
        },
        fenceMats: {
          post: new THREE.MeshStandardMaterial({
            color: "#c8a96a",
            roughness: 0.9,
          }),
          rail: new THREE.MeshStandardMaterial({
            color: "#d4b47a",
            roughness: 0.9,
          }),
        },
      };
    }, []);

  // 나무 데이터
  const treesData: Array<{ pos: [number, number, number]; scale: number }> = [
    { pos: [-10, 0, -10], scale: 1.3 },
    { pos: [-14, 0, -6], scale: 1.1 },
    { pos: [-13, 0, -13], scale: 1.4 },
    { pos: [8, 0, -12], scale: 1.2 },
    { pos: [12, 0, -8], scale: 1.0 },
    { pos: [13, 0, -13], scale: 1.35 },
    { pos: [-12, 0, 6], scale: 1.15 },
    { pos: [-10, 0, 13], scale: 1.0 },
    { pos: [14, 0, 7], scale: 1.2 },
    { pos: [-3, 0, 15], scale: 1.0 },
    { pos: [4, 0, 14], scale: 1.15 },
  ];

  return (
    <group>
      <fog attach="fog" args={["#c9e8f5", 35, 80]} />

      {/* 나무 인스턴싱 */}
      <group>
        <Instances geometry={treeGeoms.trunk} material={treeMats.trunk} castShadow>
          {treesData.map((t, i) => (
            <Instance key={i} position={[t.pos[0], t.pos[1] + 1.2, t.pos[2]]} scale={t.scale} />
          ))}
        </Instances>
        <Instances geometry={treeGeoms.leaf1} material={treeMats.leaf1} castShadow>
          {treesData.map((t, i) => (
            <Instance key={i} position={[t.pos[0], t.pos[1] + 3.2 * t.scale, t.pos[2]]} scale={t.scale} />
          ))}
        </Instances>
        <Instances geometry={treeGeoms.leaf2} material={treeMats.leaf2} castShadow>
          {treesData.map((t, i) => (
            <Instance key={i} position={[t.pos[0], t.pos[1] + 4.7 * t.scale, t.pos[2]]} scale={t.scale} />
          ))}
        </Instances>
        <Instances geometry={treeGeoms.leaf3} material={treeMats.leaf3} castShadow>
          {treesData.map((t, i) => (
            <Instance key={i} position={[t.pos[0], t.pos[1] + 6.0 * t.scale, t.pos[2]]} scale={t.scale} />
          ))}
        </Instances>
      </group>

      <Cloud position={[12, 12, -10]} speed={0.0008} />
      <Cloud position={[-18, 14, -12]} speed={0.0006} />
      <Cloud position={[22, 10, 8]} speed={0.001} />
      <Cloud position={[-8, 13, 18]} speed={0.0007} />
      <Cloud position={[5, 11, -18]} speed={0.0009} />

      <AncientTree position={[-1, 4, 6]} />

      <Lantern position={[-4, 0, -2]} isNight={isNight} />
      <Lantern position={[4, 0, -2]} isNight={isNight} />
      <Lantern position={[4, 0, 12]} isNight={isNight} />
      <Lantern position={[-12, 0, 5]} isNight={isNight} />

      <Pond position={[8, 0, 6]} scale={1.2} />

      <Bench position={[3.5, 0, 5]} rotation={-Math.PI / 2} />
      <Bench position={[-6.5, 0, 5]} rotation={Math.PI / 2} />
      <Bench position={[-1, 0, 10.5]} rotation={Math.PI} />

      <Rock position={[5, 0, 4]} scale={[2.2, 1.5, 2.4]} rotation={0.4} />
      <Rock position={[5.8, 0, 5.5]} scale={[1.4, 1.0, 1.6]} rotation={1.2} />
      <Rock position={[-6, 0, -2]} scale={[2.8, 1.8, 2.4]} rotation={0.8} />
      <Rock position={[9, 0, -3]} scale={[1.6, 1.2, 1.8]} rotation={2.1} />
      <Rock position={[-5, 0, 8]} scale={[2.0, 1.4, 2.0]} rotation={0.3} />
      <Rock position={[0, 0, 12]} scale={[1.8, 1.2, 1.6]} rotation={1.5} />

      {/* 꽃 인스턴싱 (줄기) */}
      <Instances geometry={flowerGeoms.stem} material={flowerMats.stem}>
        {FLOWERS.map((f, i) => (
          <Instance key={i} position={[f.pos[0], f.pos[1] + 0.15, f.pos[2]]} />
        ))}
      </Instances>
      
      {/* 꽃 머리 (색상별로 그룹화는 복잡하므로 여기선 기본 렌더링 유지하되 최적화 여지만 남겨둠) */}
      {FLOWERS.map((f, i) => (
        <Flower key={i} position={f.pos} color={f.color} scale={1} />
      ))}

      {/* 울타리 인스턴싱 */}
      <group>
        {/* 기둥 인스턴싱 */}
        <Instances
          geometry={fenceGeoms.post}
          material={fenceMats.post}
          castShadow
        >
          {/* 남쪽 */}
          {[-16, -14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8].map((x) => (
            <group key={`s-post-${x}`}>
              <Instance position={[x - 1.0, 0.9, 17]} />
              <Instance position={[x + 1.0, 0.9, 17]} />
            </group>
          ))}
          {/* 북쪽 */}
          {[-16, -14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12, 14, 16].map(
            (x) => (
              <group key={`n-post-${x}`}>
                <Instance position={[x - 1.0, 0.9, -17]} />
                <Instance position={[x + 1.0, 0.9, -17]} />
              </group>
            ),
          )}
          {/* 서쪽 */}
          {[-16, -14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12, 14, 16].map(
            (z) => (
              <group key={`w-post-${z}`}>
                <Instance position={[-17, 0.9, z - 1.0]} />
                <Instance position={[-17, 0.9, z + 1.0]} />
              </group>
            ),
          )}
          {/* 동쪽 */}
          {[-16, -14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12, 14, 16].map(
            (z) => (
              <group key={`e-post-${z}`}>
                <Instance position={[17, 0.9, z - 1.0]} />
                <Instance position={[17, 0.9, z + 1.0]} />
              </group>
            ),
          )}
          {/* 서쪽 (rotation 적용 필요하므로 여기선 간단히 position만 계산하거나 별도 처리) */}
          {/* ... 서쪽/동쪽은 rotation이 있어 처리가 복잡하므로 여기까지만 인스턴싱 */}
        </Instances>
        <Instances
          geometry={fenceGeoms.rail}
          material={fenceMats.rail}
          castShadow
        >
          {/* 남쪽 */}
          {[-16, -14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8].map((x) => (
            <group key={`s-rail-${x}`}>
              <Instance position={[x, 1.4, 17]} />
              <Instance position={[x, 0.6, 17]} />
            </group>
          ))}
          {/* 북쪽 */}
          {[-16, -14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12, 14, 16].map(
            (x) => (
              <group key={`n-rail-${x}`}>
                <Instance position={[x, 1.4, -17]} />
                <Instance position={[x, 0.6, -17]} />
              </group>
            ),
          )}
          {/* 서쪽 */}
          {[-16, -14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12, 14, 16].map(
            (z) => (
              <group key={`w-rail-${z}`}>
                <Instance
                  position={[-17, 1.4, z]}
                  rotation={[0, Math.PI / 2, 0]}
                />
                <Instance
                  position={[-17, 0.6, z]}
                  rotation={[0, Math.PI / 2, 0]}
                />
              </group>
            ),
          )}
          {/* 동쪽 */}
          {[-16, -14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12, 14, 16].map(
            (z) => (
              <group key={`e-rail-${z}`}>
                <Instance
                  position={[17, 1.4, z]}
                  rotation={[0, Math.PI / 2, 0]}
                />
                <Instance
                  position={[17, 0.6, z]}
                  rotation={[0, Math.PI / 2, 0]}
                />
              </group>
            ),
          )}
        </Instances>
      </group>

    </group>
  );
};

// 사전 로드
useGLTF.preload("/models/tree/cherry_blossom_tree.glb");
