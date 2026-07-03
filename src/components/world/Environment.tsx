"use client";

import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Instances, Instance, Text } from "@react-three/drei";
import { Pond } from "./Pond";
import {
  TREES,
  ROCKS,
  LANTERNS,
  BENCHES,
  FLOWERS,
  PONDS,
  LANDMARK_TREES,
  FENCES,
  SIGNS,
  BAMBOO,
  BRIDGES,
  BridgePlacement,
  LandmarkTreePlacement,
  SignPlacement,
} from "@/constants/world";

// ---------- 거대 고목 (Ancient Tree - 제공된 GLB 모델) ----------
const AncientTree = ({ placement }: { placement: LandmarkTreePlacement }) => {
  const { scene } = useGLTF("/models/tree/cherry_blossom_tree.glb");

  // 그림자 설정 및 최적화
  const treeModel = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return (
    <primitive
      object={treeModel}
      position={[placement.x, placement.y, placement.z]}
      scale={placement.scale}
      rotation={[0, placement.rotation, 0]}
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

// ---------- 구름 ----------
const Cloud = ({
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
const Signpost = ({ sign }: { sign: SignPlacement }) => (
  <group position={[sign.x, 0, sign.z]} rotation={[0, sign.rotation, 0]}>
    {/* 기둥 */}
    <mesh castShadow position={[0, 0.8, 0]}>
      <cylinderGeometry args={[0.08, 0.1, 1.6, 6]} />
      <meshStandardMaterial color="#8d6e63" roughness={0.9} />
    </mesh>
    {/* 팻말 */}
    <mesh castShadow position={[0, 1.35, 0]}>
      <boxGeometry args={[1.5, 0.55, 0.08]} />
      <meshStandardMaterial color="#a1887f" roughness={0.85} />
    </mesh>
    <Text
      position={[0, 1.35, 0.05]}
      font="/fonts/Jua-Regular.ttf"
      fontSize={0.3}
      color="#4e342e"
      anchorX="center"
      anchorY="middle"
    >
      {sign.label}
    </Text>
  </group>
);

// ---------- 나무다리 (개울 도하 지점) ----------
const Bridge = ({ bridge }: { bridge: BridgePlacement }) => {
  const plankCount = Math.floor(bridge.length / 0.62);
  return (
    <group
      position={[bridge.x, 0, bridge.z]}
      rotation={[0, bridge.rotation, 0]}
    >
      {/* 상판 널빤지 (길이 방향 = x축) */}
      {Array.from({ length: plankCount }, (_, i) => {
        const px = -bridge.length / 2 + (i + 0.5) * (bridge.length / plankCount);
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

// ---------- 정적 배경 (낮/밤과 무관하므로 memo로 리렌더 차단) ----------
const StaticScenery = memo(function StaticScenery() {
  // 인스턴스용 공통 지오메트리 & 마테리얼 생성
  const {
    treeGeoms,
    flowerGeoms,
    fenceGeoms,
    bambooGeoms,
    treeMats,
    flowerMats,
    fenceMats,
    bambooMats,
  } = useMemo(() => {
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
        bambooGeoms: {
          // 단위 높이 줄기 — 인스턴스 y 스케일로 키를 조절
          stalk: new THREE.CylinderGeometry(0.07, 0.1, 1, 6),
          leaf: new THREE.ConeGeometry(0.42, 0.85, 5),
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
          // 인스턴스별 color로 틴트하므로 베이스는 흰색
          head: new THREE.MeshStandardMaterial({
            color: "#ffffff",
            roughness: 0.5,
          }),
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
        bambooMats: {
          stalk: new THREE.MeshStandardMaterial({
            color: "#5fae4d",
            roughness: 0.75,
          }),
          leaf: new THREE.MeshStandardMaterial({
            color: "#6ecb5a",
            roughness: 0.8,
          }),
        },
      };
    }, []);

  return (
    <group>
      {/* 나무 인스턴싱 */}
      <group>
        <Instances geometry={treeGeoms.trunk} material={treeMats.trunk} castShadow>
          {TREES.map((t, i) => (
            <Instance key={i} position={[t.x, 1.2, t.z]} scale={t.scale} />
          ))}
        </Instances>
        <Instances geometry={treeGeoms.leaf1} material={treeMats.leaf1} castShadow>
          {TREES.map((t, i) => (
            <Instance key={i} position={[t.x, 3.2 * t.scale, t.z]} scale={t.scale} />
          ))}
        </Instances>
        <Instances geometry={treeGeoms.leaf2} material={treeMats.leaf2} castShadow>
          {TREES.map((t, i) => (
            <Instance key={i} position={[t.x, 4.7 * t.scale, t.z]} scale={t.scale} />
          ))}
        </Instances>
        <Instances geometry={treeGeoms.leaf3} material={treeMats.leaf3} castShadow>
          {TREES.map((t, i) => (
            <Instance key={i} position={[t.x, 6.0 * t.scale, t.z]} scale={t.scale} />
          ))}
        </Instances>
      </group>

      <Cloud position={[12, 12, -10]} speed={0.0008} seed={0.8} />
      <Cloud position={[-18, 14, -12]} speed={0.0006} seed={2.1} />
      <Cloud position={[22, 10, 8]} speed={0.001} seed={3.7} />
      <Cloud position={[-8, 13, 18]} speed={0.0007} seed={5.2} />
      <Cloud position={[5, 11, -18]} speed={0.0009} seed={1.4} />
      {/* 확장 구역 상공 */}
      <Cloud position={[34, 13, 30]} speed={0.0007} seed={7.3} />
      <Cloud position={[-34, 12, 32]} speed={0.0009} seed={8.6} />
      <Cloud position={[0, 14, 52]} speed={0.0006} seed={9.9} />
      <Cloud position={[-50, 15, -8]} speed={0.0008} seed={11.2} />

      {LANDMARK_TREES.map((t, i) => (
        <AncientTree key={i} placement={t} />
      ))}

      {PONDS.map((p, i) => (
        <Pond key={i} position={[p.x, 0, p.z]} scale={p.scale} />
      ))}

      {BRIDGES.map((b, i) => (
        <Bridge key={i} bridge={b} />
      ))}

      {/* 대나무 인스턴싱 (줄기 + 잎 2단) */}
      <group>
        <Instances
          geometry={bambooGeoms.stalk}
          material={bambooMats.stalk}
          castShadow
        >
          {BAMBOO.map((b, i) => (
            <Instance
              key={i}
              position={[b.x, b.height / 2, b.z]}
              scale={[1, b.height, 1]}
            />
          ))}
        </Instances>
        <Instances geometry={bambooGeoms.leaf} material={bambooMats.leaf}>
          {BAMBOO.map((b, i) => (
            <Instance
              key={`t-${i}`}
              position={[b.x + 0.12, b.height - 0.25, b.z]}
              rotation={[0.35, i * 1.7, 0]}
            />
          ))}
          {BAMBOO.map((b, i) => (
            <Instance
              key={`m-${i}`}
              position={[b.x - 0.14, b.height - 1.0, b.z + 0.08]}
              rotation={[-0.3, i * 2.3, 0.2]}
            />
          ))}
        </Instances>
      </group>

      {BENCHES.map((b, i) => (
        <Bench key={i} position={[b.x, 0, b.z]} rotation={b.rotation} />
      ))}

      {SIGNS.map((s, i) => (
        <Signpost key={i} sign={s} />
      ))}

      {ROCKS.map((r, i) => (
        <Rock
          key={i}
          position={[r.x, 0, r.z]}
          scale={r.scale}
          rotation={r.rotation}
        />
      ))}

      {/* 꽃 인스턴싱 (줄기 + 머리, 머리는 인스턴스별 색상) */}
      <Instances geometry={flowerGeoms.stem} material={flowerMats.stem}>
        {FLOWERS.map((f, i) => (
          <Instance key={i} position={[f.pos[0], 0.15, f.pos[2]]} />
        ))}
      </Instances>
      <Instances geometry={flowerGeoms.head} material={flowerMats.head}>
        {FLOWERS.map((f, i) => (
          <Instance key={i} position={[f.pos[0], 0.35, f.pos[2]]} color={f.color} />
        ))}
      </Instances>

      {/* 울타리 인스턴싱 (모든 존의 울타리를 한 배치로) */}
      <group>
        {/* 기둥 */}
        <Instances geometry={fenceGeoms.post} material={fenceMats.post} castShadow>
          {FENCES.map((f, fi) => (
            <group key={fi}>
              {f.lines.south.map((x) => (
                <group key={`s-post-${x}`}>
                  <Instance position={[x - 1.0, 0.9, f.dist]} />
                  <Instance position={[x + 1.0, 0.9, f.dist]} />
                </group>
              ))}
              {f.lines.north.map((x) => (
                <group key={`n-post-${x}`}>
                  <Instance position={[x - 1.0, 0.9, -f.dist]} />
                  <Instance position={[x + 1.0, 0.9, -f.dist]} />
                </group>
              ))}
              {f.lines.west.map((z) => (
                <group key={`w-post-${z}`}>
                  <Instance position={[-f.dist, 0.9, z - 1.0]} />
                  <Instance position={[-f.dist, 0.9, z + 1.0]} />
                </group>
              ))}
              {f.lines.east.map((z) => (
                <group key={`e-post-${z}`}>
                  <Instance position={[f.dist, 0.9, z - 1.0]} />
                  <Instance position={[f.dist, 0.9, z + 1.0]} />
                </group>
              ))}
            </group>
          ))}
        </Instances>
        {/* 가로대 */}
        <Instances geometry={fenceGeoms.rail} material={fenceMats.rail} castShadow>
          {FENCES.map((f, fi) => (
            <group key={fi}>
              {f.lines.south.map((x) => (
                <group key={`s-rail-${x}`}>
                  <Instance position={[x, 1.4, f.dist]} />
                  <Instance position={[x, 0.6, f.dist]} />
                </group>
              ))}
              {f.lines.north.map((x) => (
                <group key={`n-rail-${x}`}>
                  <Instance position={[x, 1.4, -f.dist]} />
                  <Instance position={[x, 0.6, -f.dist]} />
                </group>
              ))}
              {f.lines.west.map((z) => (
                <group key={`w-rail-${z}`}>
                  <Instance
                    position={[-f.dist, 1.4, z]}
                    rotation={[0, Math.PI / 2, 0]}
                  />
                  <Instance
                    position={[-f.dist, 0.6, z]}
                    rotation={[0, Math.PI / 2, 0]}
                  />
                </group>
              ))}
              {f.lines.east.map((z) => (
                <group key={`e-rail-${z}`}>
                  <Instance
                    position={[f.dist, 1.4, z]}
                    rotation={[0, Math.PI / 2, 0]}
                  />
                  <Instance
                    position={[f.dist, 0.6, z]}
                    rotation={[0, Math.PI / 2, 0]}
                  />
                </group>
              ))}
            </group>
          ))}
        </Instances>
      </group>
    </group>
  );
});

// ---------- 메인 환경 컴포넌트 ----------
export const Environment = ({ isNight = false }: { isNight?: boolean }) => {
  return (
    <group>
      <fog attach="fog" args={["#c9e8f5", 35, 80]} />

      <StaticScenery />

      {/* 석등만 isNight에 반응 */}
      {LANTERNS.map((l, i) => (
        <Lantern key={i} position={[l.x, 0, l.z]} isNight={isNight} />
      ))}
    </group>
  );
};

// 사전 로드
useGLTF.preload("/models/tree/cherry_blossom_tree.glb");
