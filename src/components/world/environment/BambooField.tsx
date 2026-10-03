"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Instances, Instance } from "@react-three/drei";
import { useHarvestStore } from "@/stores/harvestStore";
import { BAMBOO } from "@/constants/world";
import { createBambooLeafGeometry } from "./geometry";

/**
 * drei <Instances>의 frames 기본값은 Infinity라, 배치가 전혀 변하지 않아도
 * 매 프레임 인스턴스 전량의 행렬을 다시 합성하고 인스턴스 버퍼를 통째로
 * GPU에 올린다. 이 파일만 약 2,700개다.
 *
 * frames={1}은 "React 리렌더 직후 한 프레임만 갱신"을 뜻한다. drei가 그
 * 프레임의 시작에 부모 InstancedMesh의 updateMatrixWorld()로 자식 인스턴스
 * 행렬을 먼저 갱신하므로 마운트 직후에도 값이 올바르고, 수확처럼 리렌더를
 * 동반하는 변화도 그대로 반영된다.
 */

// 줄기를 따라 잎이 붙는 지점. 끝에서부터의 거리로 잡아 키가 달라도
// 수관 모양이 유지된다. 가장 낮은 대나무가 4.2라 3.2까지는 안전하다.
const BAMBOO_LEAF_TIERS = [
  { drop: 0.25, dx: 0.12, dz: 0, tilt: 0.35, spin: 1.7, scale: 1 },
  { drop: 1.0, dx: -0.14, dz: 0.08, tilt: -0.3, spin: 2.3, scale: 0.95 },
  { drop: 1.8, dx: 0.13, dz: -0.1, tilt: 0.5, spin: 3.1, scale: 0.85 },
  { drop: 2.5, dx: -0.12, dz: -0.06, tilt: -0.45, spin: 0.85, scale: 0.78 },
  { drop: 3.2, dx: 0.1, dz: 0.11, tilt: 0.42, spin: 2.7, scale: 0.7 },
];

// 마디 — 줄기 높이의 비율로 배치한다. 줄기가 위로 갈수록 가늘어지므로
// (아래 0.1 → 위 0.07) 마디도 같은 비율로 좁혀야 턱이 지지 않는다.
const BAMBOO_NODE_FRACTIONS = [0.18, 0.35, 0.52, 0.69, 0.86];

const NODE_BASE_RADIUS = 0.1;

const nodeScaleAt = (fraction: number) =>
  (0.118 - 0.03 * fraction) / NODE_BASE_RADIUS;

export const BAMBOO_CULL_BOUNDS = (() => {
  const minX = Math.min(...BAMBOO.map((b) => b.x));
  const maxX = Math.max(...BAMBOO.map((b) => b.x));
  const minZ = Math.min(...BAMBOO.map((b) => b.z));
  const maxZ = Math.max(...BAMBOO.map((b) => b.z));
  const halfWidth = (maxX - minX) / 2;
  const halfDepth = (maxZ - minZ) / 2;

  return {
    center: [(minX + maxX) / 2, (minZ + maxZ) / 2] as const,
    radius: Math.hypot(halfWidth, halfDepth),
  };
})();

// ---------- 대나무 (수확 반응형 — 수확된 줄기는 리스폰까지 숨김) ----------
export const BambooField = () => {
  const harvestedIds = useHarvestStore((s) => s.harvestedIds);
  const harvested = useMemo(() => new Set(harvestedIds), [harvestedIds]);

  const resources = useMemo(
    () => ({
      // 단위 높이 줄기 — 인스턴스 y 스케일로 키를 조절
      stalkGeom: new THREE.CylinderGeometry(0.07, 0.1, 1, 6),
      leafGeom: createBambooLeafGeometry(),
      nodeGeom: new THREE.CylinderGeometry(
        NODE_BASE_RADIUS,
        NODE_BASE_RADIUS,
        0.05,
        6,
      ),
      stalkMat: new THREE.MeshStandardMaterial({
        color: "#5fae4d",
        roughness: 0.75,
      }),
      // 잎은 평면이라 뒷면도 보인다
      leafMat: new THREE.MeshStandardMaterial({
        color: "#6ecb5a",
        roughness: 0.8,
        side: THREE.DoubleSide,
      }),
      // 마디는 줄기보다 진해야 단이 나뉘어 보인다
      nodeMat: new THREE.MeshStandardMaterial({
        color: "#47913a",
        roughness: 0.8,
      }),
    }),
    [],
  );

  useEffect(() => () => {
    for (const resource of Object.values(resources)) resource.dispose();
  }, [resources]);
  const { stalkGeom, leafGeom, nodeGeom, stalkMat, leafMat, nodeMat } = resources;

  const HIDDEN = 0.001; // 인스턴스 수를 고정한 채 스케일로만 숨김
  return (
    <group>
      <Instances
        frames={1}
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
      {/* 마디 — 줄기를 단으로 나눈다 */}
      <Instances
        frames={1}
        geometry={nodeGeom}
        material={nodeMat}
        limit={BAMBOO.length * BAMBOO_NODE_FRACTIONS.length}
      >
        {BAMBOO.map((b, i) =>
          BAMBOO_NODE_FRACTIONS.map((f) => {
            const s = nodeScaleAt(f);
            return (
              <Instance
                key={`n-${i}-${f}`}
                position={[b.x, b.height * f, b.z]}
                scale={harvested.has(i) ? HIDDEN : [s, 1, s]}
              />
            );
          }),
        )}
      </Instances>

      {/* 잎 — 끝뿐 아니라 줄기 중간에도 층층이 붙는다 */}
      <Instances
        frames={1}
        geometry={leafGeom}
        material={leafMat}
        limit={BAMBOO.length * BAMBOO_LEAF_TIERS.length}
      >
        {BAMBOO.map((b, i) =>
          BAMBOO_LEAF_TIERS.map((tier, t) => (
            <Instance
              key={`l-${i}-${t}`}
              position={[b.x + tier.dx, b.height - tier.drop, b.z + tier.dz]}
              rotation={[tier.tilt, i * tier.spin, 0]}
              scale={harvested.has(i) ? HIDDEN : tier.scale}
            />
          )),
        )}
      </Instances>
    </group>
  );
};
