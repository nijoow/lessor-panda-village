"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, memo, useState } from "react";
import * as THREE from "three";
import { PlayerState } from "@/types/multiplayer";
import { frameLerp, lerpAngle } from "@/utils/math";
import { usePandaModel, PandaBody, PandaNameTag } from "./PandaModel";

interface Props {
  id: string;
  getPlayerData: (id: string) => PlayerState | undefined;
}

const MAX_DELTA = 0.1;

const RemotePlayerInner = ({ id, getPlayerData }: Props) => {
  const groupRef = useRef<THREE.Group>(null!);
  // 닉네임은 useState로 관리 (변경 빈도가 매우 낮으므로 안전)
  const [nickname, setNickname] = useState<string>("Loading...");

  // 모델 로딩 및 애니메이션 제어 (Player와 공유)
  const { nodes, materials, playAction } = usePandaModel(groupRef);

  const targetPos = useRef(new THREE.Vector3());

  // 프레임 단위 보간 처리 (부드러운 움직임 & 최적화)
  useFrame((_state, delta) => {
    const data = getPlayerData(id);
    if (!data) return;

    const dt = Math.min(delta, MAX_DELTA);
    const t = frameLerp(0.15, dt);

    // 닉네임 업데이트 (변경 시에만 setState, 매 프레임 리렌더 방지)
    if (nickname !== data.nickname) setNickname(data.nickname);

    // 위치 보간 (Lerp) - 순간이동 방지 및 부드러운 이동
    targetPos.current.set(data.x, data.y, data.z);
    groupRef.current.position.lerp(targetPos.current, t);
    groupRef.current.updateMatrixWorld();

    // 회전 보간 - 부드러운 방향 전환 (최단 각도 계산)
    groupRef.current.rotation.y = lerpAngle(
      groupRef.current.rotation.y,
      data.ry,
      t,
    );

    // 애니메이션 동기화
    if (data.anim) playAction(data.anim);
  });

  return (
    <group ref={groupRef} dispose={null}>
      <PandaBody nodes={nodes} materials={materials} fakeShadow />
      <PandaNameTag id={id} nickname={nickname} />
    </group>
  );
};

// React.memo: 프롭(id, getPlayerData)이 동일하면 리렌더링 차단
export const RemotePlayer = memo(RemotePlayerInner);
