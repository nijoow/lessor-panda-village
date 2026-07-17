"use client";

import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Instances, Instance, Text } from "@react-three/drei";
import { Pond } from "./Pond";
import { Rivers } from "./River";
import { useHarvestStore } from "@/stores/harvestStore";
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
  RIVERS,
  GRASS_PATCHES,
  DIRT_PATCHES,
  COLLISION_PONDS,
  COLLISION_HOUSES,
  BridgePlacement,
  LandmarkTreePlacement,
  SignPlacement,
} from "@/constants/world";

// ---------- 그라운드 클러터 (풀숲·자갈) — 결정적 산개 ----------
const rand01 = (seed: number) => {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const isClear = (x: number, z: number) => {
  for (const d of DIRT_PATCHES) {
    const dx = x - d.x;
    const dz = z - d.z;
    if (dx * dx + dz * dz < (d.radius + 0.4) ** 2) return false;
  }
  for (const p of COLLISION_PONDS) {
    const dx = x - p.x;
    const dz = z - p.z;
    if (dx * dx + dz * dz < (p.radius + 0.6) ** 2) return false;
  }
  for (const h of COLLISION_HOUSES) {
    if (x > h.minX - 1 && x < h.maxX + 1 && z > h.minZ - 1 && z < h.maxZ + 1)
      return false;
  }
  return true;
};

interface TuftData {
  x: number;
  z: number;
  s: number;
  rot: number;
  shade: number;
}

// 존 잔디 패치마다 면적 비례로 풀숲을 뿌린다 (물·흙길·집 회피)
const GRASS_TUFTS: TuftData[] = (() => {
  const tufts: TuftData[] = [];
  GRASS_PATCHES.forEach((g, gi) => {
    const count = Math.min(320, Math.floor(g.width * g.depth * 0.28));
    for (let i = 0; i < count; i++) {
      const seed = gi * 1000 + i;
      const x = g.x + (rand01(seed) - 0.5) * g.width;
      const z = g.z + (rand01(seed + 0.5) - 0.5) * g.depth;
      if (!isClear(x, z)) continue;
      tufts.push({
        x,
        z,
        s: 0.7 + rand01(seed + 0.25) * 0.7,
        rot: rand01(seed + 0.75) * Math.PI,
        shade: rand01(seed + 0.33),
      });
    }
  });
  return tufts;
})();

// 흙길 위 자갈
const PEBBLES: TuftData[] = (() => {
  const pebbles: TuftData[] = [];
  DIRT_PATCHES.forEach((d, di) => {
    const count = 3 + (di % 3);
    for (let i = 0; i < count; i++) {
      const seed = di * 500 + i + 77;
      const a = rand01(seed) * Math.PI * 2;
      const r = rand01(seed + 0.4) * d.radius * 0.8;
      pebbles.push({
        x: d.x + Math.cos(a) * r,
        z: d.z + Math.sin(a) * r,
        s: 0.5 + rand01(seed + 0.2) * 0.8,
        rot: rand01(seed + 0.6) * Math.PI,
        shade: rand01(seed + 0.8),
      });
    }
  });
  return pebbles;
})();

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

// ---------- 대나무 (수확 반응형 — 수확된 줄기는 리스폰까지 숨김) ----------
const BambooField = () => {
  const harvestedIds = useHarvestStore((s) => s.harvestedIds);
  const harvested = useMemo(() => new Set(harvestedIds), [harvestedIds]);

  const { stalkGeom, leafGeom, stalkMat, leafMat } = useMemo(
    () => ({
      // 단위 높이 줄기 — 인스턴스 y 스케일로 키를 조절
      stalkGeom: new THREE.CylinderGeometry(0.07, 0.1, 1, 6),
      leafGeom: new THREE.ConeGeometry(0.42, 0.85, 5),
      stalkMat: new THREE.MeshStandardMaterial({
        color: "#5fae4d",
        roughness: 0.75,
      }),
      leafMat: new THREE.MeshStandardMaterial({
        color: "#6ecb5a",
        roughness: 0.8,
      }),
    }),
    [],
  );

  const HIDDEN = 0.001; // 인스턴스 수를 고정한 채 스케일로만 숨김
  return (
    <group>
      <Instances
        geometry={stalkGeom}
        material={stalkMat}
        limit={BAMBOO.length}
        castShadow
      >
        {BAMBOO.map((b, i) => (
          <Instance
            key={i}
            position={[b.x, b.height / 2, b.z]}
            scale={harvested.has(i) ? HIDDEN : [1, b.height, 1]}
          />
        ))}
      </Instances>
      <Instances geometry={leafGeom} material={leafMat} limit={BAMBOO.length * 2}>
        {BAMBOO.map((b, i) => (
          <Instance
            key={`t-${i}`}
            position={[b.x + 0.12, b.height - 0.25, b.z]}
            rotation={[0.35, i * 1.7, 0]}
            scale={harvested.has(i) ? HIDDEN : 1}
          />
        ))}
        {BAMBOO.map((b, i) => (
          <Instance
            key={`m-${i}`}
            position={[b.x - 0.14, b.height - 1.0, b.z + 0.08]}
            rotation={[-0.3, i * 2.3, 0.2]}
            scale={harvested.has(i) ? HIDDEN : 1}
          />
        ))}
      </Instances>
    </group>
  );
};

// 울타리 인스턴스 상한 (기둥·가로대 각각 세그먼트당 2개)
const FENCE_SEG_COUNT = FENCES.reduce(
  (n, f) =>
    n +
    f.lines.south.length +
    f.lines.north.length +
    f.lines.west.length +
    f.lines.east.length,
  0,
);

// ---------- 나무 아키타입 분류 ----------
const PINES = TREES.filter((t) => (t.variant ?? "pine") === "pine");
const ROUND_TREES = TREES.filter((t) => t.variant === "round");
const CHERRY_TREES = TREES.filter((t) => t.variant === "cherry");

const TUFT_COLORS = ["#79b859", "#8bcb66", "#9ad973"];

// ---------- 정적 배경 (낮/밤과 무관하므로 memo로 리렌더 차단) ----------
const StaticScenery = memo(function StaticScenery() {
  // 인스턴스용 공통 지오메트리 & 마테리얼 생성
  const {
    treeGeoms,
    flowerGeoms,
    fenceGeoms,
    roundTreeGeoms,
    clutterGeoms,
    treeMats,
    flowerMats,
    fenceMats,
    roundTreeMats,
    clutterMats,
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
        roundTreeGeoms: {
          trunk: new THREE.CylinderGeometry(0.3, 0.46, 2.6, 8),
          blob: new THREE.IcosahedronGeometry(1.7, 0),
          blobSide: new THREE.IcosahedronGeometry(1.15, 0),
        },
        clutterGeoms: {
          tuft: new THREE.ConeGeometry(0.3, 0.55, 5),
          pebble: new THREE.IcosahedronGeometry(0.16, 0),
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
        roundTreeMats: {
          trunk: new THREE.MeshStandardMaterial({
            color: "#7a5c3a",
            roughness: 0.9,
          }),
          leafGreen: new THREE.MeshStandardMaterial({
            color: "#63c06e",
            roughness: 0.8,
          }),
          leafGreenDark: new THREE.MeshStandardMaterial({
            color: "#4fae5f",
            roughness: 0.85,
          }),
          leafPink: new THREE.MeshStandardMaterial({
            color: "#f2b7d5",
            roughness: 0.8,
          }),
          leafPinkDark: new THREE.MeshStandardMaterial({
            color: "#e8a2c8",
            roughness: 0.85,
          }),
        },
        clutterMats: {
          tuft: new THREE.MeshStandardMaterial({
            color: "#ffffff", // 인스턴스별 색으로 틴트
            roughness: 0.95,
          }),
          pebble: new THREE.MeshStandardMaterial({
            color: "#a89f8d",
            roughness: 1,
          }),
        },
      };
    }, []);

  return (
    <group>
      {/* 침엽수 인스턴싱 */}
      <group>
        <Instances geometry={treeGeoms.trunk} material={treeMats.trunk} limit={PINES.length} castShadow>
          {PINES.map((t, i) => (
            <Instance key={i} position={[t.x, 1.2, t.z]} scale={t.scale} />
          ))}
        </Instances>
        <Instances geometry={treeGeoms.leaf1} material={treeMats.leaf1} limit={PINES.length} castShadow>
          {PINES.map((t, i) => (
            <Instance key={i} position={[t.x, 3.2 * t.scale, t.z]} scale={t.scale} />
          ))}
        </Instances>
        <Instances geometry={treeGeoms.leaf2} material={treeMats.leaf2} limit={PINES.length} castShadow>
          {PINES.map((t, i) => (
            <Instance key={i} position={[t.x, 4.7 * t.scale, t.z]} scale={t.scale} />
          ))}
        </Instances>
        <Instances geometry={treeGeoms.leaf3} material={treeMats.leaf3} limit={PINES.length} castShadow>
          {PINES.map((t, i) => (
            <Instance key={i} position={[t.x, 6.0 * t.scale, t.z]} scale={t.scale} />
          ))}
        </Instances>
      </group>

      {/* 활엽수 (둥근 수관) 인스턴싱 */}
      <group>
        <Instances
          geometry={roundTreeGeoms.trunk}
          material={roundTreeMats.trunk}
          limit={ROUND_TREES.length}
          castShadow
        >
          {ROUND_TREES.map((t, i) => (
            <Instance key={i} position={[t.x, 1.3 * t.scale, t.z]} scale={t.scale} />
          ))}
        </Instances>
        <Instances
          geometry={roundTreeGeoms.blob}
          material={roundTreeMats.leafGreen}
          limit={ROUND_TREES.length}
          castShadow
        >
          {ROUND_TREES.map((t, i) => (
            <Instance
              key={i}
              position={[t.x, 3.4 * t.scale, t.z]}
              scale={t.scale}
              rotation={[0, i * 1.1, 0]}
            />
          ))}
        </Instances>
        <Instances
          geometry={roundTreeGeoms.blobSide}
          material={roundTreeMats.leafGreenDark}
          limit={ROUND_TREES.length * 2}
          castShadow
        >
          {ROUND_TREES.map((t, i) => (
            <Instance
              key={`a-${i}`}
              position={[t.x + 0.95 * t.scale, 2.8 * t.scale, t.z + 0.3]}
              scale={t.scale}
              rotation={[0, i * 2.3, 0.2]}
            />
          ))}
          {ROUND_TREES.map((t, i) => (
            <Instance
              key={`b-${i}`}
              position={[t.x - 0.9 * t.scale, 3.0 * t.scale, t.z - 0.35]}
              scale={t.scale * 0.9}
              rotation={[0.15, i * 1.7, 0]}
            />
          ))}
        </Instances>
      </group>

      {/* 벚나무 (분홍 수관) 인스턴싱 */}
      <group>
        <Instances
          geometry={roundTreeGeoms.trunk}
          material={roundTreeMats.trunk}
          limit={CHERRY_TREES.length}
          castShadow
        >
          {CHERRY_TREES.map((t, i) => (
            <Instance key={i} position={[t.x, 1.3 * t.scale, t.z]} scale={t.scale} />
          ))}
        </Instances>
        <Instances
          geometry={roundTreeGeoms.blob}
          material={roundTreeMats.leafPink}
          limit={CHERRY_TREES.length}
          castShadow
        >
          {CHERRY_TREES.map((t, i) => (
            <Instance
              key={i}
              position={[t.x, 3.3 * t.scale, t.z]}
              scale={t.scale * 0.95}
              rotation={[0, i * 1.9, 0]}
            />
          ))}
        </Instances>
        <Instances
          geometry={roundTreeGeoms.blobSide}
          material={roundTreeMats.leafPinkDark}
          limit={CHERRY_TREES.length}
          castShadow
        >
          {CHERRY_TREES.map((t, i) => (
            <Instance
              key={i}
              position={[t.x + 0.85 * t.scale, 2.75 * t.scale, t.z - 0.3]}
              scale={t.scale * 0.85}
              rotation={[0, i * 2.6, 0.1]}
            />
          ))}
        </Instances>
      </group>

      {/* 풀숲 클러터 (인스턴스 색 틴트) */}
      <Instances geometry={clutterGeoms.tuft} material={clutterMats.tuft} limit={GRASS_TUFTS.length}>
        {GRASS_TUFTS.map((t, i) => (
          <Instance
            key={i}
            position={[t.x, 0.22 * t.s, t.z]}
            scale={[t.s, t.s, t.s * 0.8]}
            rotation={[0, t.rot, 0]}
            color={TUFT_COLORS[Math.floor(t.shade * TUFT_COLORS.length)]}
          />
        ))}
      </Instances>

      {/* 흙길 자갈 */}
      <Instances geometry={clutterGeoms.pebble} material={clutterMats.pebble} limit={PEBBLES.length}>
        {PEBBLES.map((p, i) => (
          <Instance
            key={i}
            position={[p.x, 0.05 * p.s, p.z]}
            scale={[p.s, p.s * 0.6, p.s]}
            rotation={[0, p.rot, 0]}
          />
        ))}
      </Instances>

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

      <Rivers rivers={RIVERS} />

      {BRIDGES.map((b, i) => (
        <Bridge key={i} bridge={b} />
      ))}

      {/* 대나무는 수확 반응형이라 BambooField(별도 컴포넌트)에서 렌더 */}

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
      <Instances geometry={flowerGeoms.stem} material={flowerMats.stem} limit={FLOWERS.length}>
        {FLOWERS.map((f, i) => (
          <Instance key={i} position={[f.pos[0], 0.15, f.pos[2]]} />
        ))}
      </Instances>
      <Instances geometry={flowerGeoms.head} material={flowerMats.head} limit={FLOWERS.length}>
        {FLOWERS.map((f, i) => (
          <Instance key={i} position={[f.pos[0], 0.35, f.pos[2]]} color={f.color} />
        ))}
      </Instances>

      {/* 울타리 인스턴싱 (모든 존의 울타리를 한 배치로) */}
      <group>
        {/* 기둥 */}
        <Instances geometry={fenceGeoms.post} material={fenceMats.post} limit={FENCE_SEG_COUNT * 2} castShadow>
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
        <Instances geometry={fenceGeoms.rail} material={fenceMats.rail} limit={FENCE_SEG_COUNT * 2} castShadow>
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
      <BambooField />

      {/* 석등만 isNight에 반응 */}
      {LANTERNS.map((l, i) => (
        <Lantern key={i} position={[l.x, 0, l.z]} isNight={isNight} />
      ))}
    </group>
  );
};

// 사전 로드
useGLTF.preload("/models/tree/cherry_blossom_tree.glb");
