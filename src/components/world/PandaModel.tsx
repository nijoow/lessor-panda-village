"use client";

import { useGraph, ObjectMap } from "@react-three/fiber";
import { useGLTF, useAnimations, Billboard, Text } from "@react-three/drei";
import { useCallback, useMemo, useRef, RefObject } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { ChatBubble } from "./ChatBubble";
import { getNicknameColor } from "@/utils/color";
import {
  PLAYER_ANIM_TIMESCALE,
  PlayerAnimType,
} from "@/constants/playerAnimations";

const BASE_URL = "/models/player/base.glb";
const WALK_URL = "/models/player/walking.glb";
const RUN_URL = "/models/player/running.glb";
// scripts/generate-*-clip(s).mjs로 생성한 네이티브 클립 (본 계층 + 애니메이션만 포함)
const IDLE_URL = "/models/player/idle.glb";
const SIT_URL = "/models/player/sitting.glb";
const EMOTE_URL = "/models/player/emotes.glb";

/**
 * 판다 모델 공용 훅 (Player / RemotePlayer 공유)
 * base/walking/running GLB를 로드해 복제된 노드와 애니메이션 제어를 제공합니다.
 */
export const usePandaModel = (groupRef: RefObject<THREE.Group>) => {
  const { scene: baseScene } = useGLTF(BASE_URL);
  const { animations: idleAnims } = useGLTF(IDLE_URL);
  const { animations: walkAnims } = useGLTF(WALK_URL);
  const { animations: runAnims } = useGLTF(RUN_URL);
  const { animations: sitAnims } = useGLTF(SIT_URL);
  const { animations: emoteAnims } = useGLTF(EMOTE_URL);

  // 여러 캐릭터가 동일 GLB를 공유하므로 스켈레톤 단위로 복제
  const clone = useMemo(() => SkeletonUtils.clone(baseScene), [baseScene]);
  const { nodes, materials } = useGraph(clone);

  const allAnimations = useMemo(
    () => [...idleAnims, ...walkAnims, ...runAnims, ...sitAnims, ...emoteAnims],
    [idleAnims, walkAnims, runAnims, sitAnims, emoteAnims],
  );
  const { actions } = useAnimations(allAnimations, groupRef);

  const currentActionRef = useRef<string>("");

  // 현재 클립에서 지정 클립으로 페이드 전환 (동일 클립이면 no-op)
  // timeScaleFactor: 기준 이동 속도 대비 배율 (NPC처럼 느리게 걷는 경우)
  const playAction = useCallback(
    (name: string, fade = 0.2, timeScaleFactor = 1) => {
      if (currentActionRef.current === name) return;
      const next = actions[name];
      if (!next) return;
      actions[currentActionRef.current]?.fadeOut(fade);
      // 걷기/달리기는 발 미끄러짐 보정을 위해 가속 재생
      next.setEffectiveTimeScale(
        (PLAYER_ANIM_TIMESCALE[name as PlayerAnimType] ?? 1) * timeScaleFactor,
      );
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
  const srcMaterial = materials.Material_1;

  // Meshy 원본 재질은 베이스컬러 텍스처 전체를 emissive(1,1,1)로도 쓰고
  // 스페큘러가 2배라 조명을 무시한 자체발광 + 주황 조명 번들거림이 생김.
  // 표준 재질로 정리해 장면 조명·그림자를 정상적으로 따르게 한다.
  const material = useMemo(() => {
    const map =
      srcMaterial instanceof THREE.MeshStandardMaterial
        ? srcMaterial.map
        : null;
    return new THREE.MeshStandardMaterial({
      map,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    });
  }, [srcMaterial]);

  if (!(char1 instanceof THREE.SkinnedMesh)) return null;

  return (
    <group name="Scene">
      <group name="Armature" scale={0.01}>
        <primitive object={nodes.Hips} />
        <skinnedMesh
          name="char1"
          geometry={char1.geometry}
          material={material}
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
useGLTF.preload(IDLE_URL);
useGLTF.preload(WALK_URL);
useGLTF.preload(RUN_URL);
useGLTF.preload(SIT_URL);
useGLTF.preload(EMOTE_URL);
