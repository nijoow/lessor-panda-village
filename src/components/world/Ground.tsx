"use client";

import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useMemo, useRef, useState, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { useMoveTargetStore } from '@/stores/moveTargetStore';
import {
  GRASS_PATCHES,
  DIRT_PATCHES,
  STONE_PATHS,
  WORLD_SIZE,
} from '@/constants/world';

// 걷기 한계 바깥의 경계 숲과 그 너머 안개까지 덮는 여유.
// 지면은 삼각형 두 장이라 넓혀도 비용이 없지만, 좁으면 숲 밑동에서
// 잔디가 끊겨 월드의 끝이 그대로 드러난다.
const GROUND_MARGIN = 30;
const GROUND_WIDTH = WORLD_SIZE.width + GROUND_MARGIN * 2;
const GROUND_DEPTH = WORLD_SIZE.depth + GROUND_MARGIN * 2;
// 이전 170 유닛 지면에서 42회 반복하던 밀도를 유지
const GRASS_REPEAT_PER_UNIT = 42 / 170;

// ---------- 색 패치용 소프트 마스크 ----------
// 잔디·흙 패치는 원래 사각형/원형 평면을 단색으로 덮어 경계가 직선으로
// 잘려 보였다("바닥이 타일처럼 나뉜다"). 알파맵으로 가장자리를 흐리고
// 윤곽을 흐트러뜨려 색이 지면에 스며들게 한다.
//
// three의 alphaMap은 텍스처의 알파가 아니라 초록 채널 값을 읽으므로
// 검은 바탕에 흰 얼룩을 그린다.
let patchMask: THREE.CanvasTexture | null = null;
const getPatchMask = () => {
  if (patchMask) return patchMask;

  const SIZE = 256;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 중심에서 부드럽게 떨어지는 원을 여러 개 겹쳐 울퉁불퉁한 덩어리를 만든다.
  // 결정적 좌표라 새로고침해도 같은 모양이 나온다.
  const blob = (cx: number, cy: number, r: number, peak: number) => {
    const g = ctx.createRadialGradient(cx, cy, r * 0.25, cx, cy, r);
    g.addColorStop(0, `rgba(255,255,255,${peak})`);
    g.addColorStop(0.55, `rgba(255,255,255,${peak * 0.55})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
  };

  ctx.globalCompositeOperation = "lighter";
  blob(SIZE / 2, SIZE / 2, SIZE * 0.46, 0.85);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    // 반지름을 번갈아 흔들어 정원(正圓)으로 보이지 않게 한다
    const rr = SIZE * (0.2 + ((i * 7) % 5) * 0.022);
    blob(
      SIZE / 2 + Math.cos(a) * SIZE * 0.17,
      SIZE / 2 + Math.sin(a) * SIZE * 0.17,
      rr,
      0.3,
    );
  }
  ctx.globalCompositeOperation = "source-over";

  patchMask = new THREE.CanvasTexture(canvas);
  return patchMask;
};

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
    t.repeat.set(
      GROUND_WIDTH * GRASS_REPEAT_PER_UNIT,
      GROUND_DEPTH * GRASS_REPEAT_PER_UNIT,
    );
    t.anisotropy = 16;
    return t;
  }, [grassTexture]);

  // 색 패치 전부가 공유하는 소프트 마스크 (캔버스 1장)
  const patchMask = useMemo(() => getPatchMask(), []);

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
        position={[WORLD_SIZE.centerX, -0.01, WORLD_SIZE.centerZ]}
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => e.nativeEvent.preventDefault()}
      >
        <planeGeometry args={[GROUND_WIDTH, GROUND_DEPTH]} />
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

      {/* 존별 잔디 색 패치 — 알파맵으로 가장자리를 흐려 사각 경계를 지운다.
          마스크가 바깥을 깎아내므로 원본 사각형보다 넓게 잡아야 덮는 면적이
          유지된다. */}
      {GRASS_PATCHES.map((g, i) => (
        <mesh
          key={i}
          rotation-x={-Math.PI / 2}
          receiveShadow
          position={[g.x, -0.008, g.z]}
        >
          <planeGeometry args={[g.width * 1.35, g.depth * 1.35]} />
          <meshStandardMaterial
            color={g.color}
            transparent
            opacity={g.opacity}
            alphaMap={patchMask}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* 존별 흙바닥 패치 — 같은 마스크로 흙길이 잔디에 번지게 한다 */}
      {DIRT_PATCHES.map((d, i) => (
        <mesh
          key={i}
          rotation-x={-Math.PI / 2}
          position={[d.x, -0.005, d.z]}
          receiveShadow
        >
          <planeGeometry args={[d.radius * 2.7, d.radius * 2.7]} />
          <meshStandardMaterial
            color="#bda17a"
            roughness={1.0}
            transparent
            alphaMap={patchMask}
            depthWrite={false}
          />
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
