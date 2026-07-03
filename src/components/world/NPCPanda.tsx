"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { usePandaModel, PandaBody } from "./PandaModel";
import { PLAYER_ANIM } from "@/constants/playerAnimations";
import { NpcSpec } from "@/constants/npcs";
import { findPath, Point } from "@/utils/pathfinder";
import { getNicknameColor } from "@/utils/color";
import { lerpAngle, frameLerp } from "@/utils/math";

const NPC_SPEED = 2.4; // 플레이어(4.8)의 절반 — 한가로운 산책
const BUBBLE_DURATION = 3.6;

// 결정적 의사난수 (시드 진행형)
const makeRng = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

/**
 * 배회 NPC 판다.
 * idle(2~6초) ↔ 홈 반경 내 임의 지점으로 산책을 반복하고,
 * 주기적으로 말풍선 대사를 띄운다. 이동은 A* 경로를 따른다.
 */
export const NPCPanda = ({ spec }: { spec: NpcSpec }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const { nodes, materials, playAction } = usePandaModel(groupRef);

  const rng = useRef(makeRng(spec.seed));
  const pos = useRef(new THREE.Vector3(spec.home.x, 0, spec.home.z));
  const rotY = useRef(0);
  const pathRef = useRef<Point[]>([]);
  const idleTimer = useRef(1 + spec.seed % 3);
  const speechTimer = useRef(4 + (spec.seed % 7));
  const [bubble, setBubble] = useState<string | null>(null);
  const bubbleTimer = useRef(0);
  const phraseIdx = useRef(spec.seed % spec.phrases.length);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.1);

    // ---------- 말풍선 ----------
    if (bubble) {
      bubbleTimer.current -= dt;
      if (bubbleTimer.current <= 0) setBubble(null);
    } else {
      speechTimer.current -= dt;
      if (speechTimer.current <= 0) {
        phraseIdx.current = (phraseIdx.current + 1) % spec.phrases.length;
        setBubble(spec.phrases[phraseIdx.current]);
        bubbleTimer.current = BUBBLE_DURATION;
        speechTimer.current = 9 + rng.current() * 9;
      }
    }

    // ---------- 배회 ----------
    if (pathRef.current.length === 0) {
      playAction(PLAYER_ANIM.IDLE, 0.25);
      idleTimer.current -= dt;
      if (idleTimer.current <= 0) {
        const a = rng.current() * Math.PI * 2;
        const r = 1.5 + rng.current() * (spec.home.radius - 1.5);
        const target = {
          x: spec.home.x + Math.cos(a) * r,
          z: spec.home.z + Math.sin(a) * r,
        };
        const path = findPath({ x: pos.current.x, z: pos.current.z }, target);
        if (path.length > 0) pathRef.current = path;
        idleTimer.current = 2 + rng.current() * 4;
      }
    } else {
      const wp = pathRef.current[0];
      const dx = wp.x - pos.current.x;
      const dz = wp.z - pos.current.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.15) {
        pathRef.current.shift();
      } else {
        const step = Math.min(dist, NPC_SPEED * dt);
        pos.current.x += (dx / dist) * step;
        pos.current.z += (dz / dist) * step;
        rotY.current = Math.atan2(dx, dz);
        playAction(PLAYER_ANIM.WALK, 0.2, NPC_SPEED / 4.8);
      }
    }

    groupRef.current.position.x = pos.current.x;
    groupRef.current.position.z = pos.current.z;
    groupRef.current.rotation.y = lerpAngle(
      groupRef.current.rotation.y,
      rotY.current,
      frameLerp(0.12, dt),
    );
  });

  return (
    <group ref={groupRef} position={[spec.home.x, 0, spec.home.z]}>
      <PandaBody nodes={nodes} materials={materials} fakeShadow />
      <Billboard position={[0, 3, 0.6]}>
        <Text
          font="/fonts/Jua-Regular.ttf"
          fontSize={0.45}
          color={getNicknameColor(spec.id)}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#ffffff"
        >
          {spec.name}
        </Text>
        {bubble && (
          <Text
            font="/fonts/Jua-Regular.ttf"
            fontSize={0.42}
            position={[0, 0.85, 0]}
            color="#3a3a3a"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.09}
            outlineColor="#ffffff"
            maxWidth={7}
          >
            {bubble}
          </Text>
        )}
      </Billboard>
    </group>
  );
};
