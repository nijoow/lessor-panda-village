"use client";

import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Pond } from "../Pond";
import { Rivers } from "../River";
import { ROCKS, BENCHES, PONDS, LANDMARK_TREES, SIGNS, BRIDGES, RIVERS } from "@/constants/world";
import { createGrassTuftGeometry, createFlowerHeadGeometry } from "./geometry";
import { PINE_RECORDS, ROUND_TREE_RECORDS, CHERRY_TREE_RECORDS, GRASS_TUFT_RECORDS, PEBBLE_RECORDS, FLOWER_RECORDS, FENCE_POST_RECORDS, FENCE_RAIL_RECORDS } from "./placements";
import { AncientTree, Bench, Rock, Cloud, Signpost, Bridge } from "./Structures";
import { CulledInstances } from "./CulledInstances";

// ---------- 정적 배경 (낮/밤과 무관하므로 memo로 리렌더 차단) ----------
export const StaticScenery = memo(function StaticScenery() {
  // 인스턴스용 공통 지오메트리 & 마테리얼 생성
  const resources = useMemo(() => {
    return {
      treeGeoms: {
        trunk: new THREE.CylinderGeometry(0.28, 0.42, 2.4, 8),
        leaf1: new THREE.ConeGeometry(2.0, 2.6, 8),
        leaf2: new THREE.ConeGeometry(1.5, 2.1, 8),
        leaf3: new THREE.ConeGeometry(1.0, 1.8, 8),
      },
      flowerGeoms: {
        stem: new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5),
        head: createFlowerHeadGeometry(),
        core: new THREE.SphereGeometry(0.045, 6, 5),
      },
      fenceGeoms: {
        post: new THREE.BoxGeometry(0.2, 1.8, 0.2),
        rail: new THREE.BoxGeometry(2.0, 0.15, 0.15),
      },
      roundTreeGeoms: {
        trunk: new THREE.CylinderGeometry(0.3, 0.46, 2.6, 8),
        blob: new THREE.IcosahedronGeometry(1.7, 1),
        blobSide: new THREE.IcosahedronGeometry(1.15, 1),
      },
      clutterGeoms: {
        tuft: createGrassTuftGeometry(),
        pebble: new THREE.IcosahedronGeometry(0.16, 0),
      },
      treeMats: {
        trunk: new THREE.MeshStandardMaterial({ color: "#7a5c3a", roughness: 0.9 }),
        leaf1: new THREE.MeshStandardMaterial({ color: "#4caf63", roughness: 0.8 }),
        leaf2: new THREE.MeshStandardMaterial({ color: "#56cc72", roughness: 0.8 }),
        leaf3: new THREE.MeshStandardMaterial({ color: "#69e086", roughness: 0.7 }),
      },
      flowerMats: {
        stem: new THREE.MeshStandardMaterial({ color: "#4a7a3a" }),
        head: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5, side: THREE.DoubleSide }),
        core: new THREE.MeshStandardMaterial({ color: "#f6d55c", roughness: 0.6 }),
      },
      fenceMats: {
        post: new THREE.MeshStandardMaterial({ color: "#c8a96a", roughness: 0.9 }),
        rail: new THREE.MeshStandardMaterial({ color: "#d4b47a", roughness: 0.9 }),
      },
      roundTreeMats: {
        trunk: new THREE.MeshStandardMaterial({ color: "#7a5c3a", roughness: 0.9 }),
        leafGreen: new THREE.MeshStandardMaterial({ color: "#63c06e", roughness: 0.8 }),
        leafGreenDark: new THREE.MeshStandardMaterial({ color: "#4fae5f", roughness: 0.85 }),
        leafPink: new THREE.MeshStandardMaterial({ color: "#f2b7d5", roughness: 0.8 }),
        leafPinkDark: new THREE.MeshStandardMaterial({ color: "#e8a2c8", roughness: 0.85 }),
      },
      clutterMats: {
        tuft: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95, side: THREE.DoubleSide }),
        pebble: new THREE.MeshStandardMaterial({ color: "#a89f8d", roughness: 1 }),
      },
    };
  }, []);
  useEffect(() => () => {
    for (const group of Object.values(resources)) {
      for (const resource of Object.values(group)) resource.dispose();
    }
  }, [resources]);
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
  } = resources;

  return (
    <group>
      <CulledInstances
        name="pine-trunks"
        records={PINE_RECORDS.trunk}
        geometry={treeGeoms.trunk}
        material={treeMats.trunk}
        castShadow
      />
      <CulledInstances
        name="pine-crowns-lower"
        records={PINE_RECORDS.leaf1}
        geometry={treeGeoms.leaf1}
        material={treeMats.leaf1}
        castShadow
      />
      <CulledInstances
        name="pine-crowns-middle"
        records={PINE_RECORDS.leaf2}
        geometry={treeGeoms.leaf2}
        material={treeMats.leaf2}
        castShadow
      />
      <CulledInstances
        name="pine-crowns-upper"
        records={PINE_RECORDS.leaf3}
        geometry={treeGeoms.leaf3}
        material={treeMats.leaf3}
        castShadow
      />

      <CulledInstances
        name="round-tree-trunks"
        records={ROUND_TREE_RECORDS.trunk}
        geometry={roundTreeGeoms.trunk}
        material={roundTreeMats.trunk}
        castShadow
      />
      <CulledInstances
        name="round-tree-crowns"
        records={ROUND_TREE_RECORDS.crown}
        geometry={roundTreeGeoms.blob}
        material={roundTreeMats.leafGreen}
        castShadow
      />
      <CulledInstances
        name="round-tree-side-crowns"
        records={ROUND_TREE_RECORDS.sides}
        geometry={roundTreeGeoms.blobSide}
        material={roundTreeMats.leafGreenDark}
        castShadow
      />

      <CulledInstances
        name="cherry-tree-trunks"
        records={CHERRY_TREE_RECORDS.trunk}
        geometry={roundTreeGeoms.trunk}
        material={roundTreeMats.trunk}
        castShadow
      />
      <CulledInstances
        name="cherry-tree-crowns"
        records={CHERRY_TREE_RECORDS.crown}
        geometry={roundTreeGeoms.blob}
        material={roundTreeMats.leafPink}
        castShadow
      />
      <CulledInstances
        name="cherry-tree-side-crowns"
        records={CHERRY_TREE_RECORDS.side}
        geometry={roundTreeGeoms.blobSide}
        material={roundTreeMats.leafPinkDark}
        castShadow
      />

      <CulledInstances
        name="grass-tufts"
        records={GRASS_TUFT_RECORDS}
        geometry={clutterGeoms.tuft}
        material={clutterMats.tuft}
      />
      <CulledInstances
        name="path-pebbles"
        records={PEBBLE_RECORDS}
        geometry={clutterGeoms.pebble}
        material={clutterMats.pebble}
      />

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

      <CulledInstances
        name="flower-stems"
        records={FLOWER_RECORDS.stem}
        geometry={flowerGeoms.stem}
        material={flowerMats.stem}
      />
      <CulledInstances
        name="flower-heads"
        records={FLOWER_RECORDS.head}
        geometry={flowerGeoms.head}
        material={flowerMats.head}
      />
      <CulledInstances
        name="flower-cores"
        records={FLOWER_RECORDS.core}
        geometry={flowerGeoms.core}
        material={flowerMats.core}
      />

      <CulledInstances
        name="fence-posts"
        records={FENCE_POST_RECORDS}
        geometry={fenceGeoms.post}
        material={fenceMats.post}
        castShadow
      />
      <CulledInstances
        name="fence-rails"
        records={FENCE_RAIL_RECORDS}
        geometry={fenceGeoms.rail}
        material={fenceMats.rail}
        castShadow
      />
    </group>
  );
});
