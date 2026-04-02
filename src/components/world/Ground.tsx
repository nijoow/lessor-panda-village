"use client";

import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useMemo, useState, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';

// ---------- 클릭 지점 표시 마커 컴포넌트 ----------
const ClickMarker = ({ position }: { position: THREE.Vector3 }) => {
  const [opacity, setOpacity] = useState(1);
  const [scale, setScale] = useState(0.5);

  useFrame((_state, delta) => {
    if (opacity > 0) {
      setOpacity((prev) => Math.max(0, prev - delta * 2));
      setScale((prev) => prev + delta * 2.5);
    }
  });

  if (opacity <= 0) return null;

  return (
    <mesh
      position={[position.x, 0.05, position.z]}
      rotation-x={-Math.PI / 2}
    >
      <ringGeometry args={[0.4 * scale, 0.5 * scale, 32]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={opacity}
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
    t.repeat.set(20, 20);
    t.anisotropy = 16;
    return t;
  }, [grassTexture]);

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      // 채팅 입력 등의 이유로 클릭이 비활성화된 경우 무시
      if (disableClick) return;

      // 버블링 방지 (다른 UI 클릭 시 바닥 이동 방지)
      e.stopPropagation();

      const point = e.point.clone();
      setClickPos(point);

      // 플레이어에게 알림 (커스텀 이벤트)
      window.dispatchEvent(
        new CustomEvent('panda-move-to', {
          detail: { x: point.x, z: point.z },
        }),
      );
    },
    [disableClick],
  );

  return (
    <group>
      {/* 메인 잔디 바닥 - 클릭 감지용 */}
      <mesh
        rotation-x={-Math.PI / 2}
        receiveShadow
        position={[0, -0.01, 0]}
        onPointerDown={handlePointerDown}
      >
        <planeGeometry args={[80, 80]} />
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

      {/* 안쪽 원형 잔디 */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.008, 0]}>
        <planeGeometry args={[33, 33]} />
        <meshStandardMaterial color="#8fcf5a" transparent opacity={0.55} />
      </mesh>

      {/* 베이스 흙길 (Subtle) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.005, -3]} receiveShadow>
        <circleGeometry args={[4.5, 36]} />
        <meshStandardMaterial color="#bda17a" roughness={1.0} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-2, -0.005, 5]} receiveShadow>
        <circleGeometry args={[7, 32]} />
        <meshStandardMaterial color="#bda17a" roughness={1.0} />
      </mesh>

      {/* 입체 돌길 (Stone Paths) */}
      {/* 집 앞마당 -> 중앙 광장 */}
      <StonePath start={[0, -2]} end={[0, 4]} width={3} density={2.5} />

      {/* 중앙 광장 -> 연못 (x:8, z:6) */}
      <StonePath start={[2, 5]} end={[6, 6]} width={2} density={2} />

      {/* 집 -> 왼쪽 나무 구역 */}
      <StonePath start={[-2, -2]} end={[-6, 0]} width={1.5} density={1.8} />
    </group>
  );
};
