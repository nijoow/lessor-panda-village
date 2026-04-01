"use client";

import { useGraph, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, Text, Billboard } from "@react-three/drei";
import { useRef, useMemo, memo, useState } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { PlayerState } from "@/hooks/useMultiplayer";
import { PLAYER_ANIM } from "@/constants/playerAnimations";
import { ChatBubble } from "./ChatBubble";
import { getNicknameColor } from "@/utils/color";

interface Props {
  id: string;
  getPlayerData: (id: string) => PlayerState | undefined;
}

const lerpAngle = (start: number, end: number, t: number) => {
  const diff = ((end - start + Math.PI) % (Math.PI * 2)) - Math.PI;
  return start + diff * t;
};

const RemotePlayerInner = ({ id, getPlayerData }: Props) => {
  const groupRef = useRef<THREE.Group>(null!);
  // 닉네임은 useState로 관리 (변경 빈도가 매우 낮으므로 안전)
  const [nickname, setNickname] = useState<string>('Loading...');

  // 1. 모델 로딩
  const { scene: baseScene, animations: idleAnims } = useGLTF(
    "/models/player/base.glb",
  );
  const { animations: walkAnims } = useGLTF("/models/player/walking.glb");
  const { animations: runAnims } = useGLTF("/models/player/running.glb");

  // 2. 모델 복제
  const clone = useMemo(() => SkeletonUtils.clone(baseScene), [baseScene]);
  const { nodes, materials } = useGraph(clone);

  // 3. 애니메이션 통합
  const allAnimations = useMemo(
    () => [...idleAnims, ...walkAnims, ...runAnims],
    [idleAnims, walkAnims, runAnims],
  );
  const { actions } = useAnimations(allAnimations, groupRef);

  const currentActionRef = useRef<string>("");
  const targetPos = useMemo(() => new THREE.Vector3(), []);

  // 4. 프레임 단위 보간 처리 (부드러운 움직임 & 최적화)
  useFrame(() => {
    const data = getPlayerData(id);
    if (!data) return;

    // 닉네임 업데이트 (변경 시에만 setState, 매 프레임 리렌더 방지)
    if (nickname !== data.nickname) setNickname(data.nickname);

    // 위치 보간 (Lerp) - 순간이동 방지 및 부드러운 이동
    targetPos.set(data.x, data.y, data.z);
    groupRef.current.position.lerp(targetPos, 0.15);

    // 회전 보간 - 부드러운 방향 전환 (최단 각도 계산)
    groupRef.current.rotation.y = lerpAngle(
      groupRef.current.rotation.y,
      data.ry,
      0.15,
    );

    // 애니메이션 동기화
    let animation = data.anim;
    if (animation === "idle") animation = PLAYER_ANIM.IDLE;
    if (animation === "walk") animation = PLAYER_ANIM.WALK;
    if (animation === "run") animation = PLAYER_ANIM.RUN;

    if (animation && currentActionRef.current !== animation) {
      const prev = actions[currentActionRef.current];
      const next = actions[animation];
      if (next) {
        prev?.fadeOut(0.2);
        next.reset().fadeIn(0.2).play();
        currentActionRef.current = animation;
      }
    }
  });

  return (
    <group ref={groupRef} dispose={null}>
      {/* Chat Bubble - chatStore 직접 구독 */}
      <ChatBubble playerId={id} />

      <group name="Scene">
        <group name="Armature" scale={0.01}>
          <primitive object={nodes.Hips} />
          <skinnedMesh
            name="char1"
            geometry={(nodes.char1 as THREE.SkinnedMesh).geometry}
            material={materials.Material_1}
            skeleton={(nodes.char1 as THREE.SkinnedMesh).skeleton}
          />
          {/* 부하가 적은 가짜 그림자 적용 (최적화) */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <circleGeometry args={[0.35, 32]} />
            <meshBasicMaterial
              color="black"
              transparent
              opacity={0.2}
              depthWrite={false}
            />
          </mesh>
        </group>
        {/* 닉네임 표시 */}
        <Billboard position={[0, 3, 0.6]}>
          <Text
            fontSize={0.4}
            color={getNicknameColor(id)}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
            outlineColor="#ffffff"
          >
            {nickname}
          </Text>
        </Billboard>
      </group>
    </group>
  );
};

// React.memo: 프롭(id, getPlayerData)이 동일하면 리렌더링 차단
export const RemotePlayer = memo(RemotePlayerInner);

// 사전 로딩
useGLTF.preload("/models/player/base.glb");
useGLTF.preload("/models/player/walking.glb");
useGLTF.preload("/models/player/running.glb");
