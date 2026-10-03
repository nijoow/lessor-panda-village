"use client";

import assets from "@/constants/assets.json";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, memo, useState } from "react";
import * as THREE from "three";
import { PlayerState } from "@/types/multiplayer";
import { frameLerp, lerpAngle } from "@/utils/math";
import { usePandaModel, PandaBody, PandaNameTag } from "./PandaModel";
import { getFogFar, fogSphereVisible } from "@/lib/rendering/culling";

interface Props {
  id: string;
  getPlayerData: (id: string) => PlayerState | undefined;
}

const MAX_DELTA = 0.1;

const RemotePlayerInner = ({ id, getPlayerData }: Props) => {
  const medium = useGLTF(assets.player.urls.lodMedium);
  const far = useGLTF(assets.player.urls.lodFar);
  const lodGeometries = useMemo(() => {
    const midMesh = medium.nodes[assets.player.meshNode];
    const farMesh = far.nodes.char1;
    return midMesh instanceof THREE.Mesh && farMesh instanceof THREE.Mesh
      ? ([midMesh.geometry, farMesh.geometry] as const)
      : undefined;
  }, [medium.nodes, far.nodes]);
  const groupRef = useRef<THREE.Group>(null!);
  // 닉네임은 useState로 관리 (변경 빈도가 매우 낮으므로 안전)
  const [nickname, setNickname] = useState<string>("Loading...");

  // 모델 로딩 및 애니메이션 제어 (Player와 공유)
  const { nodes, materials, playAction } = usePandaModel(groupRef, true);

  const nameTagRef = useRef<THREE.Group>(null!);
  const depthPoint = useRef(new THREE.Vector3());
  const frustum = useRef(new THREE.Frustum());
  const viewProjection = useRef(new THREE.Matrix4());
  const bounds = useRef(new THREE.Sphere(new THREE.Vector3(), 3));
  const initialized = useRef(false);
  const targetPos = useRef(new THREE.Vector3());

  // 프레임 단위 보간 처리 (부드러운 움직임 & 최적화)
  useFrame((state, delta) => {
    const data = getPlayerData(id);
    if (!data) {
      groupRef.current.visible = false;
      initialized.current = false;
      return;
    }
    depthPoint.current
      .set(data.x, data.y + 1.5, data.z)
      .applyMatrix4(state.camera.matrixWorldInverse);
    bounds.current.center.set(data.x, data.y + 1.5, data.z);
    viewProjection.current.multiplyMatrices(
      state.camera.projectionMatrix,
      state.camera.matrixWorldInverse,
    );
    frustum.current.setFromProjectionMatrix(viewProjection.current);
    groupRef.current.visible =
      fogSphereVisible(
        -depthPoint.current.z,
        bounds.current.radius,
        getFogFar(state.scene),
      ) && frustum.current.intersectsSphere(bounds.current);
    if (!groupRef.current.visible) {
      // Resume at the current network pose, not the last pose seen by this camera.
      initialized.current = false;
      return;
    }

    const dt = Math.min(delta, MAX_DELTA);
    const t = frameLerp(0.15, dt);

    // 닉네임 업데이트 (변경 시에만 setState, 매 프레임 리렌더 방지)
    if (nickname !== data.nickname) setNickname(data.nickname);

    // 위치 보간 (Lerp) - 순간이동 방지 및 부드러운 이동
    targetPos.current.set(data.x, data.y, data.z);
    if (!initialized.current) {
      groupRef.current.position.copy(targetPos.current);
      groupRef.current.rotation.y = data.ry;
      initialized.current = true;
    } else {
      groupRef.current.position.lerp(targetPos.current, t);
      groupRef.current.rotation.y = lerpAngle(
        groupRef.current.rotation.y,
        data.ry,
        t,
      );
    }
    groupRef.current.updateMatrixWorld();
    nameTagRef.current.visible =
      state.camera.position.distanceToSquared(groupRef.current.position) <
      55 * 55;

    // 애니메이션 동기화
    if (data.anim) playAction(data.anim);
  });

  return (
    <group ref={groupRef} dispose={null}>
      <PandaBody
        nodes={nodes}
        materials={materials}
        fakeShadow
        lodGeometries={lodGeometries}
      />
      <group ref={nameTagRef}>
        <PandaNameTag id={id} nickname={nickname} />
      </group>
    </group>
  );
};

// React.memo: 프롭(id, getPlayerData)이 동일하면 리렌더링 차단
export const RemotePlayer = memo(RemotePlayerInner);
