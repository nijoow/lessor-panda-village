"use client";

import { useGraph, ObjectMap } from "@react-three/fiber";
import { useGLTF, useAnimations, Billboard, Text } from "@react-three/drei";
import { useCallback, useMemo, useRef, RefObject } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { ChatBubble } from "./ChatBubble";
import { getNicknameColor } from "@/utils/color";

const BASE_URL = "/models/player/base.glb";
const WALK_URL = "/models/player/walking.glb";
const RUN_URL = "/models/player/running.glb";

/**
 * 판다 모델 공용 훅 (Player / RemotePlayer 공유)
 * base/walking/running GLB를 로드해 복제된 노드와 애니메이션 제어를 제공합니다.
 */
export const usePandaModel = (groupRef: RefObject<THREE.Group>) => {
  const { scene: baseScene, animations: idleAnims } = useGLTF(BASE_URL);
  const { animations: walkAnims } = useGLTF(WALK_URL);
  const { animations: runAnims } = useGLTF(RUN_URL);

  // 여러 캐릭터가 동일 GLB를 공유하므로 스켈레톤 단위로 복제
  const clone = useMemo(() => SkeletonUtils.clone(baseScene), [baseScene]);
  const { nodes, materials } = useGraph(clone);

  const allAnimations = useMemo(
    () => [...idleAnims, ...walkAnims, ...runAnims],
    [idleAnims, walkAnims, runAnims],
  );
  const { actions } = useAnimations(allAnimations, groupRef);

  const currentActionRef = useRef<string>("");

  // 현재 클립에서 지정 클립으로 페이드 전환 (동일 클립이면 no-op)
  const playAction = useCallback(
    (name: string, fade = 0.2) => {
      if (currentActionRef.current === name) return;
      const next = actions[name];
      if (!next) return;
      actions[currentActionRef.current]?.fadeOut(fade);
      next.reset().fadeIn(fade).play();
      currentActionRef.current = name;
    },
    [actions],
  );

  const getCurrentAction = useCallback(() => currentActionRef.current, []);

  return { nodes, materials, playAction, getCurrentAction };
};

interface PandaBodyProps {
  nodes: ObjectMap["nodes"];
  materials: ObjectMap["materials"];
  /** 실제 그림자 사용 여부 (로컬 플레이어만 true) */
  castShadow?: boolean;
  /** 부하가 적은 가짜 원형 그림자 (원격 플레이어용) */
  fakeShadow?: boolean;
}

export const PandaBody = ({
  nodes,
  materials,
  castShadow = false,
  fakeShadow = false,
}: PandaBodyProps) => {
  // GLB 그래프는 런타임에만 형상이 확정되므로 단언 대신 instanceof로 검증
  const char1 = nodes.char1;
  if (!(char1 instanceof THREE.SkinnedMesh)) return null;

  return (
    <group name="Scene">
      <group name="Armature" scale={0.01}>
        <primitive object={nodes.Hips} />
        <skinnedMesh
          name="char1"
          geometry={char1.geometry}
          material={materials.Material_1}
          skeleton={char1.skeleton}
          castShadow={castShadow}
          receiveShadow={castShadow}
        />
      </group>
      {/* Armature(scale 0.01) 밖에 두어야 실제 크기로 보임 */}
      {fakeShadow && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <circleGeometry args={[0.35, 32]} />
          <meshBasicMaterial
            color="black"
            transparent
            opacity={0.2}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
};

export const PandaNameTag = ({
  id,
  nickname,
}: {
  id: string;
  nickname: string;
}) => (
  <Billboard position={[0, 3, 0.6]}>
    <Text
      font="/fonts/Jua-Regular.ttf"
      fontSize={0.5}
      color={getNicknameColor(id)}
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.02}
      outlineColor="#ffffff"
    >
      {nickname}
    </Text>
    <ChatBubble playerId={id} />
  </Billboard>
);

// 사전 로딩
useGLTF.preload(BASE_URL);
useGLTF.preload(WALK_URL);
useGLTF.preload(RUN_URL);
