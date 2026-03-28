'use client';

import { useFrame, useGraph } from '@react-three/fiber';
import { useKeyboardControls, useGLTF, useAnimations } from '@react-three/drei';
import { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

export enum Controls {
  forward = 'forward',
  backward = 'backward',
  left = 'left',
  right = 'right',
  run = 'run',
}

// 등각 뷰(Isometric)에서 카메라 방향을 기준으로 월드 이동 방향을 계산합니다.
// 카메라 오프셋이 (+X, +Y, +Z) 방향이므로 카메라는 남서쪽에서 바라봅니다.
// "위" 방향키 -> 화면의 왼쪽 위 -> 월드 좌표 (-X, -Z)
// "오른쪽" 방향키 -> 화면의 오른쪽 위 -> 월드 좌표 (+X, -Z)
const CAM_FORWARD = new THREE.Vector3(-1, 0, -1).normalize(); // 화면 상단 방향 (World)
const CAM_RIGHT = new THREE.Vector3(1, 0, -1).normalize();   // 화면 우측 방향 (World)

const lerpAngle = (start: number, end: number, t: number) => {
  const diff = ((end - start + Math.PI) % (Math.PI * 2)) - Math.PI;
  return start + diff * t;
};

export const Player = () => {
  const groupRef = useRef<THREE.Group>(null!);
  const [, getKeys] = useKeyboardControls<Controls>();

  // 1. 모델 로딩 (Base, Walking, Running)
  const { scene: baseScene, animations: idleAnims } = useGLTF('/models/player/base.glb');
  const { animations: walkAnims } = useGLTF('/models/player/walking.glb');
  const { animations: runAnims } = useGLTF('/models/player/running.glb');

  // 2. 모델 복제 및 그래프 추출
  const clone = useMemo(() => SkeletonUtils.clone(baseScene), [baseScene]);
  const { nodes, materials } = useGraph(clone);

  // 3. 모든 애니메이션 통합 관리
  const allAnimations = useMemo(() => [
    ...idleAnims,
    ...walkAnims,
    ...runAnims,
  ], [idleAnims, walkAnims, runAnims]);

  const { actions } = useAnimations(allAnimations, groupRef);

  // 4. 현재 액션을 ref로 관리 (useFrame에서 setState 호출 금지)
  const currentActionRef = useRef<string>('');
  const targetPosition = useRef(new THREE.Vector3(0, 0, 0));
  const targetRotation = useRef(0);

  // 5. actions가 로딩되면 Idle 애니메이션 시작
  useEffect(() => {
    const idleClipName = 'Armature|clip0|baselayer';
    const action = actions[idleClipName];
    if (action) {
      action.reset().play();
      currentActionRef.current = idleClipName;
    }
  }, [actions]);

  useFrame((state) => {
    if (!groupRef.current) return;

    const { forward, backward, left, right, run } = getKeys();

    // 6. 카메라 기준 이동 벡터 계산
    const moveForward = (forward ? 1 : 0) - (backward ? 1 : 0);
    const moveRight = (right ? 1 : 0) - (left ? 1 : 0);

    const isMoving = moveForward !== 0 || moveRight !== 0;
    const speed = run ? 0.18 : 0.08;

    if (isMoving) {
      // 카메라 기준 방향 벡터를 세계 좌표계 이동으로 변환
      const moveDir = new THREE.Vector3()
        .addScaledVector(CAM_FORWARD, moveForward)
        .addScaledVector(CAM_RIGHT, moveRight)
        .normalize()
        .multiplyScalar(speed);

      targetPosition.current.x += moveDir.x;
      targetPosition.current.z += moveDir.z;

      // 이동 방향으로 캐릭터 회전
      targetRotation.current = Math.atan2(moveDir.x, moveDir.z);

      // 7. 애니메이션 전환 (ref 기반으로 setState 없이 처리)
      const nextClip = run ? 'Armature|running|baselayer' : 'Armature|walking_man|baselayer';
      if (currentActionRef.current !== nextClip) {
        const prev = actions[currentActionRef.current];
        const next = actions[nextClip];
        if (next) {
          prev?.fadeOut(0.2);
          next.reset().fadeIn(0.2).play();
          currentActionRef.current = nextClip;
        }
      }
    } else {
      // 정지 시 Idle 전환
      const idleClip = 'Armature|clip0|baselayer';
      if (currentActionRef.current !== idleClip) {
        const prev = actions[currentActionRef.current];
        const next = actions[idleClip];
        if (next) {
          prev?.fadeOut(0.2);
          next.reset().fadeIn(0.2).play();
          currentActionRef.current = idleClip;
        }
      }
    }

    // 8. 위치 및 회전 부드럽게 보간
    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetPosition.current.x, 0.15);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetPosition.current.z, 0.15);

    groupRef.current.rotation.y = lerpAngle(
      groupRef.current.rotation.y,
      targetRotation.current,
      0.12
    );

    // 9. 카메라 트래킹 (등각 오프셋 유지)
    const camOffset = new THREE.Vector3(14, 14, 14);
    state.camera.position.lerp(
      groupRef.current.position.clone().add(camOffset),
      0.1
    );
    state.camera.lookAt(groupRef.current.position);
  });

  return (
    <group ref={groupRef} dispose={null}>
      <group name="Scene">
        <group name="Armature" scale={0.01}>
          <primitive object={nodes.Hips} />
          <skinnedMesh
            name="char1"
            geometry={(nodes.char1 as THREE.SkinnedMesh).geometry}
            material={materials.Material_1}
            skeleton={(nodes.char1 as THREE.SkinnedMesh).skeleton}
            castShadow
            receiveShadow
          />
        </group>
      </group>
    </group>
  );
};

// 사전 로딩
useGLTF.preload('/models/player/base.glb');
useGLTF.preload('/models/player/walking.glb');
useGLTF.preload('/models/player/running.glb');
