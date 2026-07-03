"use client";

import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useMemo, useRef, useState, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { useMoveTargetStore } from '@/stores/moveTargetStore';
import { GRASS_PATCHES, DIRT_PATCHES, STONE_PATHS } from '@/constants/world';

// ---------- 클릭 지점 표시 마커 컴포넌트 ----------
// setState 대신 ref로 직접 조작하여 매 프레임 리렌더/geometry 재생성을 방지
const ClickMarker = ({ position }: { position: THREE.Vector3 }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null!);
  const anim = useRef({ opacity: 1, scale: 0.5 });

  useFrame((_state, delta) => {
    const a = anim.current;
    if (a.opacity <= 0) return;

    a.opacity = Math.max(0, a.opacity - delta * 2);
    a.scale += delta * 2.5;

    materialRef.current.opacity = a.opacity;
    meshRef.current.scale.setScalar(a.scale);
    meshRef.current.visible = a.opacity > 0;
  });

  return (
    <mesh
      ref={meshRef}
      position={[position.x, 0.05, position.z]}
      rotation-x={-Math.PI / 2}
      scale={0.5}
    >
      <ringGeometry args={[0.4, 0.5, 32]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#ffffff"
        transparent
        opacity={1}
        depthWrite={false}
      />
    </mesh>
  );
};

// ---------- 돌길 컴포넌트 (작은 돌들을 배치하여 입체적인 길 표현) ----------
const SteppingStone = ({
  position,
  scale = 1,
  rotation = 0,
}: {
  position: [number, number, number];
  scale?: number;
  rotation?: number;
}) => (
  <mesh
    position={position}
    rotation={[-Math.PI / 2, 0, rotation]}
    receiveShadow
  >
    <circleGeometry args={[0.4 * scale, 8]} />
    <meshStandardMaterial color="#9e9e9e" roughness={0.9} />
  </mesh>
);

const StonePath = ({
  start,
  end,
  width = 2,
  density = 1.5,
}: {
  start: [number, number];
  end: [number, number];
  width?: number;
  density?: number;
}) => {
  const stones = useMemo(() => {
    const temp = [];
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const dist = Math.sqrt(dx * dx + dz * dz);
    const count = Math.floor(dist * density);

    for (let i = 0; i < count; i++) {
      const t = i / count;
      const x = start[0] + dx * t + Math.sin(i * 1.5) * width * 0.3;
      const z = start[1] + dz * t + Math.cos(i * 0.8) * width * 0.2;
      // Idempotent values (Math.random 대신 인덱스 활용)
      const s = 0.8 + Math.sin(i * 2.1) * 0.3;
      const r = i * 0.5;
      temp.push({ x, z, s, r });
    }
    return temp;
  }, [start, end, width, density]);

  return (
    <group>
      {stones.map((stone, i) => (
        <SteppingStone
          key={i}
          position={[stone.x, -0.003, stone.z]}
          scale={stone.s}
          rotation={stone.r}
        />
      ))}
    </group>
  );
};

export const Ground = ({ disableClick }: { disableClick?: boolean }) => {
  const grassTexture = useTexture('/textures/ground/grass.png');
  const [clickPos, setClickPos] = useState<THREE.Vector3 | null>(null);

  const groundTexture = useMemo(() => {
    const t = grassTexture.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(42, 42);
    t.anisotropy = 16;
    return t;
  }, [grassTexture]);

  const requestMove = useMoveTargetStore((state) => state.requestMove);

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      // 채팅 입력 등의 이유로 클릭이 비활성화된 경우 무시
      if (disableClick) return;

      // 마우스 사용자라면 우클릭(2)만 허용, 터치/펜 등은 일반 클릭 허용
      if (e.pointerType === "mouse" && e.button !== 2) return;

      // 버블링 방지 (다른 UI 클릭 시 바닥 이동 방지)
      e.stopPropagation();

      const point = e.point.clone();
      setClickPos(point);

      // 플레이어에게 이동 요청 전달
      requestMove(point.x, point.z);
    },
    [disableClick, requestMove],
  );

  return (
    <group>
      {/* 메인 잔디 바닥 - 클릭 감지용 */}
      <mesh
        rotation-x={-Math.PI / 2}
        receiveShadow
        position={[0, -0.01, 0]}
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => e.nativeEvent.preventDefault()}
      >
        <planeGeometry args={[170, 170]} />
        <meshStandardMaterial
          map={groundTexture}
          color="#a8d876"
          roughness={0.85}
        />
      </mesh>

      {/* 클릭 마커 표시 (위치가 바뀔 때마다 key를 사용하여 리셋) */}
      {clickPos && (
        <ClickMarker
          key={`${clickPos.x}-${clickPos.z}`}
          position={clickPos}
        />
      )}

      {/* 존별 잔디 색 패치 */}
      {GRASS_PATCHES.map((g, i) => (
        <mesh
          key={i}
          rotation-x={-Math.PI / 2}
          receiveShadow
          position={[g.x, -0.008, g.z]}
        >
          <planeGeometry args={[g.width, g.depth]} />
          <meshStandardMaterial
            color={g.color}
            transparent
            opacity={g.opacity}
          />
        </mesh>
      ))}

      {/* 존별 흙바닥 패치 */}
      {DIRT_PATCHES.map((d, i) => (
        <mesh
          key={i}
          rotation-x={-Math.PI / 2}
          position={[d.x, -0.005, d.z]}
          receiveShadow
        >
          <circleGeometry args={[d.radius, 32]} />
          <meshStandardMaterial color="#bda17a" roughness={1.0} />
        </mesh>
      ))}

      {/* 존별 입체 돌길 (Stone Paths) */}
      {STONE_PATHS.map((p, i) => (
        <StonePath
          key={i}
          start={p.start}
          end={p.end}
          width={p.width}
          density={p.density}
        />
      ))}
    </group>
  );
};
