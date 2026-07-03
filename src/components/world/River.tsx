"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Instances, Instance } from "@react-three/drei";
import * as THREE from "three";
import { RiverSpec } from "@/constants/world";

/**
 * 폴리라인 리본 강.
 * - 바닥: 모래빛 강바닥 리본 (물보다 넓게)
 * - 수면: 반투명 물 리본 + 흐르는 하이라이트 텍스처(UV 스크롤)
 * - 강둑: 갈대·강돌 인스턴싱 (결정적 배치)
 */

// 폴리라인을 따라 리본 BufferGeometry 생성 (마이터 없이 평균 법선)
const buildRibbon = (points: Array<[number, number]>, width: number) => {
  const half = width / 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const normals = points.map((_, i) => {
    const [px, pz] = points[Math.max(0, i - 1)];
    const [nx, nz] = points[Math.min(points.length - 1, i + 1)];
    const dx = nx - px;
    const dz = nz - pz;
    const len = Math.hypot(dx, dz) || 1;
    return [-dz / len, dx / len] as const;
  });

  let v = 0;
  points.forEach(([x, z], i) => {
    const [ox, oz] = normals[i];
    positions.push(x - ox * half, 0, z - oz * half);
    positions.push(x + ox * half, 0, z + oz * half);
    // 이전 포인트와의 거리 누적으로 v좌표 (텍스처 흐름 방향)
    if (i > 0) {
      const [qx, qz] = points[i - 1];
      v += Math.hypot(x - qx, z - qz) / 6;
    }
    uvs.push(0, v, 1, v);
    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
};

// 흐르는 물결 하이라이트 텍스처 (프로시저럴 캔버스)
const buildFlowTexture = () => {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 14; i++) {
    const y = (i * 41) % 128;
    const x = (i * 67) % 128;
    const w = 30 + ((i * 23) % 40);
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.6 + ((i * 13) % 10) / 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y + 4, x + w, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
};

// 강둑 소품(갈대·강돌)의 결정적 배치
const bankProps = (river: RiverSpec) => {
  const reeds: Array<{ x: number; z: number; s: number; r: number }> = [];
  const stones: Array<{ x: number; z: number; s: number; r: number }> = [];
  const half = river.width / 2;
  river.points.forEach(([x, z], i) => {
    if (i === 0 || i >= river.points.length - 1) return;
    const [px, pz] = river.points[i - 1];
    const dx = x - px;
    const dz = z - pz;
    const len = Math.hypot(dx, dz) || 1;
    const ox = -dz / len;
    const oz = dx / len;
    for (const side of [-1, 1]) {
      const jitter = ((i * 37 + side * 11) % 10) / 10;
      const bx = x + ox * side * (half + 0.7 + jitter);
      const bz = z + oz * side * (half + 0.7 + jitter);
      if ((i + side + 3) % 3 === 0) {
        reeds.push({ x: bx, z: bz, s: 0.8 + jitter * 0.5, r: i * 1.3 });
        reeds.push({
          x: bx + 0.4,
          z: bz - 0.3,
          s: 0.7 + jitter * 0.4,
          r: i * 2.1,
        });
      } else if ((i + side + 3) % 3 === 1) {
        stones.push({ x: bx, z: bz, s: 0.5 + jitter * 0.5, r: i * 0.8 });
      }
    }
  });
  return { reeds, stones };
};

const RiverRibbon = ({ river }: { river: RiverSpec }) => {
  const flowRef = useRef<THREE.MeshBasicMaterial>(null!);

  const { bedGeom, waterGeom, flowTex, reeds, stones } = useMemo(() => {
    return {
      bedGeom: buildRibbon(river.points, river.width + 1.8),
      waterGeom: buildRibbon(river.points, river.width),
      flowTex: buildFlowTexture(),
      ...bankProps(river),
    };
  }, [river]);

  useFrame((state, delta) => {
    // 물이 하류(폴리라인 진행 방향)로 흐르는 하이라이트
    const mat = flowRef.current;
    if (!mat?.map) return;
    mat.map.offset.y -= delta * 0.22;
    mat.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 0.8) * 0.06;
  });

  return (
    <group>
      {/* 강바닥 (모래빛) */}
      <mesh geometry={bedGeom} position={[0, 0.005, 0]} receiveShadow>
        <meshStandardMaterial color="#c9b98a" roughness={1} />
      </mesh>
      {/* 수면 */}
      <mesh geometry={waterGeom} position={[0, 0.05, 0]}>
        <meshStandardMaterial
          color="#4fa8cf"
          transparent
          opacity={0.82}
          roughness={0.15}
          metalness={0.05}
        />
      </mesh>
      {/* 흐르는 하이라이트 */}
      <mesh geometry={waterGeom} position={[0, 0.07, 0]}>
        <meshBasicMaterial
          ref={flowRef}
          map={flowTex}
          transparent
          opacity={0.32}
          depthWrite={false}
        />
      </mesh>

      {/* 갈대 (줄기 + 이삭) */}
      <Instances limit={reeds.length} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 1.15, 5]} />
        <meshStandardMaterial color="#6f9c4a" roughness={0.85} />
        {reeds.map((p, i) => (
          <Instance
            key={i}
            position={[p.x, 0.55 * p.s, p.z]}
            scale={[1, p.s, 1]}
            rotation={[0.08, p.r, -0.06]}
          />
        ))}
      </Instances>
      <Instances limit={reeds.length}>
        <cylinderGeometry args={[0.07, 0.07, 0.3, 5]} />
        <meshStandardMaterial color="#8a6b45" roughness={0.9} />
        {reeds.map((p, i) => (
          <Instance
            key={i}
            position={[p.x, 1.1 * p.s, p.z]}
            scale={p.s}
            rotation={[0.08, p.r, -0.06]}
          />
        ))}
      </Instances>

      {/* 강가 돌 */}
      <Instances limit={stones.length} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial color="#9a9a98" roughness={0.95} />
        {stones.map((p, i) => (
          <Instance
            key={i}
            position={[p.x, 0.12 * p.s, p.z]}
            scale={[p.s, p.s * 0.65, p.s]}
            rotation={[0, p.r, 0]}
          />
        ))}
      </Instances>
    </group>
  );
};

export const Rivers = ({ rivers }: { rivers: RiverSpec[] }) => (
  <group>
    {rivers.map((r, i) => (
      <RiverRibbon key={i} river={r} />
    ))}
  </group>
);
