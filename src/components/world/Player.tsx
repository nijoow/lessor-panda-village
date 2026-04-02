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
import { getNicknameColor } from "@/utils/color";
import { checkCollision } from "@/utils/collision";
import { findPath, Point } from "@/utils/pathfinder";

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
  inputDisabled?: boolean;
}

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

export const Player = forwardRef<THREE.Group, Props>(
  ({ id, nickname, onMove, inputDisabled }, ref) => {
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

    // 클릭 이동 목표 및 경로 관리
    const clickTarget = useRef<THREE.Vector3 | null>(null);
    const pathRef = useRef<Point[]>([]);
    const pathIndexRef = useRef<number>(0);

    useEffect(() => {
      const handleMoveTo = (e: Event) => {
        if (inputDisabled) return;

        const customEvent = e as CustomEvent<{ x: number; z: number }>;
        const start = {
          x: targetPosition.current.x,
          z: targetPosition.current.z,
        };
        const end = {
          x: customEvent.detail.x,
          z: customEvent.detail.z,
        };

        // 길찾기 수행
        const computedPath = findPath(start, end);
        if (computedPath.length > 0) {
          pathRef.current = computedPath;
          pathIndexRef.current = 0;
          clickTarget.current = new THREE.Vector3(
            computedPath[0].x,
            0,
            computedPath[0].z,
          );
        }
      };
      window.addEventListener("panda-move-to", handleMoveTo);
      return () => window.removeEventListener("panda-move-to", handleMoveTo);
    }, [inputDisabled]);

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

      // 키보드 입력이 있으면 클릭 이동 취소
      if (forward || backward || left || right) {
        clickTarget.current = null;
        pathRef.current = [];
        pathIndexRef.current = 0;
      }

      // 6. 점프 및 중력 물리
      const GRAVITY = -0.006;
      const JUMP_FORCE = 0.14;

      if (jump && isGrounded.current) {
        velocityY.current = JUMP_FORCE;
        isGrounded.current = false;
      }

      const currentY = targetPosition.current.y;

      if (!isGrounded.current) {
        velocityY.current += GRAVITY;
        targetPosition.current.y += velocityY.current;

        if (targetPosition.current.y <= 0) {
          targetPosition.current.y = 0;
          velocityY.current = 0;
          isGrounded.current = true;
        }
      }

      // 7. 이동 벡터 계산
      const moveDir = new THREE.Vector3(0, 0, 0);
      let isMoving = false;

      // 키보드 이동 우선 체크
      const keyboardForward = (forward ? 1 : 0) - (backward ? 1 : 0);
      const keyboardRight = (right ? 1 : 0) - (left ? 1 : 0);

      if (keyboardForward !== 0 || keyboardRight !== 0) {
        moveDir
          .addScaledVector(CAM_FORWARD, keyboardForward)
          .addScaledVector(CAM_RIGHT, keyboardRight)
          .normalize();
        isMoving = true;
      }
      // 클릭 이동 체크 (키보드 이동이 없을 때만)
      else if (clickTarget.current) {
        const dist = new THREE.Vector2(
          clickTarget.current.x - targetPosition.current.x,
          clickTarget.current.z - targetPosition.current.z,
        ).length();

        // 현재 목적지(경유지)에 도착했는지 확인
        if (dist > 0.15) {
          moveDir
            .set(
              clickTarget.current.x - targetPosition.current.x,
              0,
              clickTarget.current.z - targetPosition.current.z,
            )
            .normalize();
          isMoving = true;
        } else {
          // 다음 경유지로 이동
          pathIndexRef.current++;
          if (pathIndexRef.current < pathRef.current.length) {
            const nextPoint = pathRef.current[pathIndexRef.current];
            clickTarget.current = new THREE.Vector3(
              nextPoint.x,
              0,
              nextPoint.z,
            );
          } else {
            // 경로 종료
            clickTarget.current = null;
            pathRef.current = [];
            pathIndexRef.current = 0;
          }
        }
      }

      const speed = run ? 0.12 : 0.08;

      if (isMoving) {
        moveDir.multiplyScalar(speed);

        // 충돌 체크 후 이동
        const nextX = targetPosition.current.x + moveDir.x;
        const nextZ = targetPosition.current.z + moveDir.z;

        const canMoveX = !checkCollision(
          nextX,
          targetPosition.current.z,
          currentY,
        );
        const canMoveZ = !checkCollision(
          targetPosition.current.x,
          nextZ,
          currentY,
        );

        if (canMoveX) {
          targetPosition.current.x = nextX;
        }
        if (canMoveZ) {
          targetPosition.current.z = nextZ;
        }

        // 클릭 이동 중인데 양쪽 다 막혔다면 목표 취소
        if (clickTarget.current && !canMoveX && !canMoveZ) {
          clickTarget.current = null;
          pathRef.current = [];
          pathIndexRef.current = 0;
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
      groupRef.current.updateMatrixWorld();

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
