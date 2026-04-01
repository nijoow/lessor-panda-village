"use client";

import { useFrame, useGraph } from "@react-three/fiber";
import {
  useKeyboardControls,
  useGLTF,
  useAnimations,
  Billboard,
  Text,
} from "@react-three/drei";
import {
  useRef,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { PLAYER_ANIM } from "@/constants/playerAnimations";
import { ChatBubble } from "./ChatBubble";
import { ChatMessage } from "@/hooks/useMultiplayer";
import { getNicknameColor } from "@/utils/color";

interface Props {
  id: string;
  nickname: string;
  onMove?: (state: {
    x: number;
    y: number;
    z: number;
    ry: number;
    anim: string;
  }) => void;
  lastChatMessage?: ChatMessage;
  inputDisabled?: boolean;
}

import {
  COLLISION_TREES,
  COLLISION_ROCKS,
  COLLISION_HOUSE,
  WORLD_BOUNDS,
  COLLISION_LANDMARK,
  COLLISION_BENCHES,
  COLLISION_POND,
  COLLISION_LANTERNS,
} from "@/constants/collisionMap";

export enum Controls {
  forward = "forward",
  backward = "backward",
  left = "left",
  right = "right",
  run = "run",
  jump = "jump",
  interact = "interact",
  nightToggle = "nightToggle",
}

// 등각 뷰(Isometric)에서 카메라 방향을 기준으로 월드 이동 방향을 계산합니다.
// 카메라 오프셋이 (+X, +Y, +Z) 방향이므로 카메라는 남서쪽에서 바라봅니다.
const CAM_FORWARD = new THREE.Vector3(-1, 0, -1).normalize();
const CAM_RIGHT = new THREE.Vector3(1, 0, -1).normalize();

const lerpAngle = (start: number, end: number, t: number) => {
  const diff = ((end - start + Math.PI) % (Math.PI * 2)) - Math.PI;
  return start + diff * t;
};

// 충돌 체크 함수 (y값을 추가하여 점프 시 통과 여부 결정)
const checkCollision = (x: number, z: number, y: number) => {
  // 1. 월드 경계 체크 (가장 바깥쪽 80x80 잔디 영역)
  if (
    x < WORLD_BOUNDS.min ||
    x > WORLD_BOUNDS.max ||
    z < WORLD_BOUNDS.min ||
    z > WORLD_BOUNDS.max
  )
    return true;

  // 2. 나무 충돌 (항상 충돌, 점프로 못 넘음)
  for (const tree of COLLISION_TREES) {
    const dx = x - tree.x;
    const dz = z - tree.z;
    if (dx * dx + dz * dz < tree.radius * tree.radius) return true;
  }

  // 3. 바위 충돌 (낮은 바위는 점프 중 y > 1.0이면 통과 가능)
  if (y < 1.0) {
    for (const rock of COLLISION_ROCKS) {
      const dx = x - rock.x;
      const dz = z - rock.z;
      if (dx * dx + dz * dz < rock.radius * rock.radius) return true;
    }
  }

  // 4. 집 충돌 (항상 충돌, 점프로 못 넘음)
  if (
    x > COLLISION_HOUSE.minX &&
    x < COLLISION_HOUSE.maxX &&
    z > COLLISION_HOUSE.minZ &&
    z < COLLISION_HOUSE.maxZ
  ) {
    return true;
  }

  // 5. 울타리 충돌 (x, z = ±17 라인에서 점프 중 y > 1.3이면 통과 가능)
  const FENCE_DIST = 17;
  const FENCE_THICKNESS = 0.4;
  if (y < 1.3) {
    const absX = Math.abs(x);
    const absZ = Math.abs(z);

    // 남/북 울타리 (z축 기준)
    if (
      absZ > FENCE_DIST - FENCE_THICKNESS &&
      absZ < FENCE_DIST + FENCE_THICKNESS
    ) {
      if (z < 0) {
        // 북쪽 (z = -17): 전 구간 (x in [-17.5, 17.5])
        if (x > -17.5 && x < 17.5) return true;
      } else {
        // 남쪽 (z = 17): 설치된 구간만 (x in [-17.5, 9.5])
        // x=8 위치의 세그먼트가 마지막이므로 x=9.5 정도까지 차단
        if (x > -17.5 && x < 9.5) return true;
      }
    }
    // 동/서 울타리 (x축 기준)
    if (
      absX > FENCE_DIST - FENCE_THICKNESS &&
      absX < FENCE_DIST + FENCE_THICKNESS
    ) {
      // 동/서 울타리는 전 구간 차단
      if (z > -17.5 && z < 17.5) return true;
    }
  }

  // 6. 랜드마크 고목 충돌 (항상 충돌, 점프로 못 넘음)
  const dxL = x - COLLISION_LANDMARK.x;
  const dzL = z - COLLISION_LANDMARK.z;
  if (
    dxL * dxL + dzL * dzL <
    COLLISION_LANDMARK.radius * COLLISION_LANDMARK.radius
  )
    return true;

  // 7. 벤치 충돌 (낮은 벤치는 점프 중 y > 0.8이면 통과 가능)
  if (y < 0.8) {
    for (const bench of COLLISION_BENCHES) {
      if (
        x > bench.minX &&
        x < bench.maxX &&
        z > bench.minZ &&
        z < bench.maxZ
      ) {
        return true;
      }
    }
  }

  // 8. 평온한 연못 충돌 (항상 충돌, 점프로 못 넘음)
  const dxP = x - COLLISION_POND.x;
  const dzP = z - COLLISION_POND.z;
  if (dxP * dxP + dzP * dzP < COLLISION_POND.radius * COLLISION_POND.radius)
    return true;

  // 9. 석등 충돌 (항상 충돌)
  for (const lantern of COLLISION_LANTERNS) {
    const dx = x - lantern.x;
    const dz = z - lantern.z;
    if (dx * dx + dz * dz < lantern.radius * lantern.radius) return true;
  }

  return false;
};

export const Player = forwardRef<THREE.Group, Props>(
  ({ id, nickname, onMove, lastChatMessage, inputDisabled }, ref) => {
    const groupRef = useRef<THREE.Group>(null!);

    // 외부에서 groupRef를 사용할 수 있도록 노출
    useImperativeHandle(ref, () => groupRef.current);

    const [, getKeys] = useKeyboardControls<Controls>();

    // 네트워크 전송 최적화를 위한 타이머 및 상태 캐시
    const lastUpdateRef = useRef(0);
    const lastSentStateRef = useRef({
      x: 0,
      y: 0,
      z: 0,
      ry: 0,
      anim: "",
    });

    // 초기 위치 브로드캐스트
    useEffect(() => {
      if (onMove) {
        onMove({
          x: 0,
          y: 0,
          z: 0,
          ry: 0,
          anim: PLAYER_ANIM.IDLE,
        });
      }
    }, [onMove]);

    // 1. 모델 로딩 (Base, Walking, Running)
    const { scene: baseScene, animations: idleAnims } = useGLTF(
      "/models/player/base.glb",
    );
    const { animations: walkAnims } = useGLTF("/models/player/walking.glb");
    const { animations: runAnims } = useGLTF("/models/player/running.glb");

    // 2. 모델 복제 및 그래프 추출
    const clone = useMemo(() => SkeletonUtils.clone(baseScene), [baseScene]);
    const { nodes, materials } = useGraph(clone);

    // 3. 모든 애니메이션 통합 관리
    const allAnimations = useMemo(
      () => [...idleAnims, ...walkAnims, ...runAnims],
      [idleAnims, walkAnims, runAnims],
    );

    const { actions } = useAnimations(allAnimations, groupRef);

    // 4. 현재 액션 및 물리 상태 ref로 관리
    const currentActionRef = useRef<string>("");
    const targetPosition = useRef(new THREE.Vector3(0, 0, 0));
    const targetRotation = useRef(0);
    const velocityY = useRef(0);
    const isGrounded = useRef(true);

    // 5. actions가 로딩되면 Idle 애니메이션 시작
    useEffect(() => {
      const idleClipName = PLAYER_ANIM.IDLE;
      const action = actions[idleClipName];
      if (action) {
        action.reset().play();
        currentActionRef.current = idleClipName;
      }
    }, [actions]);

    useFrame((state, delta) => {
      if (!groupRef.current) return;

      const keys = getKeys();
      const { forward, backward, left, right, run, jump } = inputDisabled
        ? {
            forward: false,
            backward: false,
            left: false,
            right: false,
            run: false,
            jump: false,
          }
        : keys;

      // 6. 점프 및 중력 물리
      const GRAVITY = -0.006;
      const JUMP_FORCE = 0.14;

      if (jump && isGrounded.current) {
        velocityY.current = JUMP_FORCE;
        isGrounded.current = false;
      }

      if (!isGrounded.current) {
        velocityY.current += GRAVITY;
        targetPosition.current.y += velocityY.current;

        if (targetPosition.current.y <= 0) {
          targetPosition.current.y = 0;
          velocityY.current = 0;
          isGrounded.current = true;
        }
      }

      // 7. 카메라 기준 이동 벡터 계산
      const moveForward = (forward ? 1 : 0) - (backward ? 1 : 0);
      const moveRight = (right ? 1 : 0) - (left ? 1 : 0);

      const isMoving = moveForward !== 0 || moveRight !== 0;
      const speed = run ? 0.12 : 0.08;

      if (isMoving) {
        const moveDir = new THREE.Vector3()
          .addScaledVector(CAM_FORWARD, moveForward)
          .addScaledVector(CAM_RIGHT, moveRight)
          .normalize()
          .multiplyScalar(speed);

        // 충돌 체크 후 이동 (현재 Y 좌표 전달)
        const nextX = targetPosition.current.x + moveDir.x;
        const nextZ = targetPosition.current.z + moveDir.z;
        const currentY = targetPosition.current.y;

        if (!checkCollision(nextX, targetPosition.current.z, currentY)) {
          targetPosition.current.x = nextX;
        }
        if (!checkCollision(targetPosition.current.x, nextZ, currentY)) {
          targetPosition.current.z = nextZ;
        }

        // 이동 방향으로 캐릭터 회전
        targetRotation.current = Math.atan2(moveDir.x, moveDir.z);

        // 애니메이션 전환
        const nextClip = run ? PLAYER_ANIM.RUN : PLAYER_ANIM.WALK;
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
        const idleClip = PLAYER_ANIM.IDLE;
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
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x,
        targetPosition.current.x,
        0.15,
      );
      groupRef.current.position.y = targetPosition.current.y; // Y축은 즉시 반영 (물리)
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z,
        targetPosition.current.z,
        0.15,
      );

      groupRef.current.rotation.y = lerpAngle(
        groupRef.current.rotation.y,
        targetRotation.current,
        0.12,
      );

      // 9. 네트워크 데이터 전송 최적화 (10fps + 변화 감지)
      lastUpdateRef.current += delta;
      if (lastUpdateRef.current > 0.1) {
        // 100ms 마다 체크 (요금 절감)
        const currentPos = groupRef.current.position;
        const currentRot = groupRef.current.rotation.y;
        const currentAnim = currentActionRef.current;

        // 이전 전송값과 비교 (임계값 설정)
        const hasMoved =
          Math.abs(lastSentStateRef.current.x - currentPos.x) > 0.01 ||
          Math.abs(lastSentStateRef.current.z - currentPos.z) > 0.01 ||
          Math.abs(lastSentStateRef.current.y - currentPos.y) > 0.01 ||
          Math.abs(lastSentStateRef.current.ry - currentRot) > 0.01 ||
          lastSentStateRef.current.anim !== currentAnim;

        if (hasMoved) {
          onMove?.({
            x: currentPos.x,
            y: currentPos.y,
            z: currentPos.z,
            ry: currentRot,
            anim: currentAnim,
          });

          // 캐시 업데이트
          lastSentStateRef.current = {
            x: currentPos.x,
            y: currentPos.y,
            z: currentPos.z,
            ry: currentRot,
            anim: currentAnim,
          };
        }
        lastUpdateRef.current = 0;
      }

      // 10. 카메라 트래킹 (등각 오프셋 유지)
      const camOffset = new THREE.Vector3(14, 14, 14);
      state.camera.position.lerp(
        groupRef.current.position.clone().add(camOffset),
        0.1,
      );
      state.camera.lookAt(groupRef.current.position);
    });

    return (
      <group ref={groupRef} dispose={null}>
        {/* Chat Bubble */}
        {lastChatMessage && (
          <ChatBubble
            message={lastChatMessage.message}
            timestamp={lastChatMessage.timestamp}
          />
        )}

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
  },
);

Player.displayName = "Player";

// 사전 로딩
useGLTF.preload("/models/player/base.glb");
useGLTF.preload("/models/player/walking.glb");
useGLTF.preload("/models/player/running.glb");
