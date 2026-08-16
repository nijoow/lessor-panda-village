"use client";

import { useFrame } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import {
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import * as THREE from "three";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { PLAYER_ANIM } from "@/constants/playerAnimations";
import { BAMBOO, BENCHES, NOTICE_BOARDS, zoneAt } from "@/constants/world";
import { checkCollision } from "@/utils/collision";
import { findPath, Point } from "@/utils/pathfinder";
import { frameLerp, lerpAngle } from "@/utils/math";
import { useMoveTargetStore } from "@/stores/moveTargetStore";
import { useInteractionStore } from "@/stores/interactionStore";
import { useZoneStore } from "@/stores/zoneStore";
import { useHarvestStore } from "@/stores/harvestStore";
import { useGuestbookStore } from "@/stores/guestbookStore";
import { audio } from "@/lib/audio";
import { usePandaModel, PandaBody, PandaNameTag } from "./PandaModel";

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
  emoteWave = "emoteWave",
  emoteDance = "emoteDance",
}

// 등각 뷰(Isometric)에서 카메라 방향을 기준으로 월드 이동 방향을 계산합니다.
// 카메라 오프셋이 (+X, +Y, +Z) 방향이므로 카메라는 남서쪽에서 바라봅니다.
const CAM_FORWARD = new THREE.Vector3(-1, 0, -1).normalize();
const CAM_RIGHT = new THREE.Vector3(1, 0, -1).normalize();

// 물리 상수 (초당 단위 - 프레임레이트 무관)
const WALK_SPEED = 4.8; // units/s (기존 0.08/frame @60fps)
const RUN_SPEED = 7.2; // units/s (기존 0.12/frame @60fps)
const GRAVITY = -21.6; // units/s²
const JUMP_FORCE = 8.4; // units/s
const MAX_DELTA = 0.1; // 탭 전환 등 비정상적으로 큰 delta 클램프

// 벤치 앉기 상수
const SIT_RANGE = 2.2; // 벤치 중심 기준 상호작용 가능 거리
const HARVEST_RANGE = 1.9; // 대나무 수확 가능 거리
const SEAT_SLOT_OFFSET = 0.55; // 좌석 2칸의 벤치 긴 축 방향 오프셋
const SIT_GROUP_Y = 0.04; // 앉기 클립의 엉덩이 높이에 맞춘 그룹 y 보정
const STAND_OFFSET = 0.9; // 일어설 때 벤치 앞으로 내려서는 거리 (충돌 박스 밖)

interface Seat {
  x: number;
  z: number;
  ry: number; // 앉은 방향 (벤치 정면)
}

// 벤치 긴 축(local +X)을 따라 두 좌석 중 플레이어와 가까운 쪽을 선택
const pickSeat = (benchIndex: number, px: number, pz: number): Seat => {
  const bench = BENCHES[benchIndex];
  const cos = Math.cos(bench.rotation);
  const sin = Math.sin(bench.rotation);
  let best: Seat = { x: bench.x, z: bench.z, ry: bench.rotation };
  let bestDist = Infinity;
  for (const slot of [-SEAT_SLOT_OFFSET, SEAT_SLOT_OFFSET]) {
    const x = bench.x + slot * cos;
    const z = bench.z - slot * sin;
    const d = (x - px) ** 2 + (z - pz) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = { x, z, ry: bench.rotation };
    }
  }
  return best;
};

// useFrame 스크래치 객체 (매 프레임 할당으로 인한 GC 압박 방지)
const _moveDir = new THREE.Vector3();
const _camDelta = new THREE.Vector3();

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

    // 모델 로딩 및 애니메이션 제어 (RemotePlayer와 공유)
    const { nodes, materials, playAction, getCurrentAction } =
      usePandaModel(groupRef);

    // 물리 상태 ref로 관리
    const targetPosition = useRef(new THREE.Vector3(0, 0, 0));
    const stepDistRef = useRef(0);
    const targetRotation = useRef(0);
    const velocityY = useRef(0);
    const isGrounded = useRef(true);

    // 로딩되면 Idle 애니메이션 시작
    useEffect(() => {
      playAction(PLAYER_ANIM.IDLE);
    }, [playAction]);

    // 클릭 이동 목표 및 경로 관리
    const clickTarget = useRef<THREE.Vector3 | null>(null);
    const pathRef = useRef<Point[]>([]);
    const pathIndexRef = useRef<number>(0);

    const clearClickPath = () => {
      clickTarget.current = null;
      pathRef.current = [];
      pathIndexRef.current = 0;
    };

    // 벤치 앉기 상태
    const seatRef = useRef<Seat | null>(null);
    const prevInteractRef = useRef(false);
    const lastSitRequestIdRef = useRef(0);
    const lastHarvestRequestIdRef = useRef(0);

    // 이모트 상태 (이동·점프·앉기 등 다른 행동 시 해제)
    const emoteRef = useRef<string | null>(null);
    const prevEmoteKeysRef = useRef({ wave: false, dance: false });
    const lastEmoteRequestIdRef = useRef(0);

    const standUp = useCallback(() => {
      const seat = seatRef.current;
      if (!seat) return;
      // 벤치 정면 방향으로 내려서기 (벤치 충돌 박스 바깥 지점)
      targetPosition.current.set(
        seat.x + Math.sin(seat.ry) * STAND_OFFSET,
        0,
        seat.z + Math.cos(seat.ry) * STAND_OFFSET,
      );
      seatRef.current = null;
      useInteractionStore.getState().setSitting(false);
    }, []);

    const sitDown = (benchIndex: number) => {
      seatRef.current = pickSeat(
        benchIndex,
        targetPosition.current.x,
        targetPosition.current.z,
      );
      clearClickPath();
      emoteRef.current = null;
      velocityY.current = 0;
      isGrounded.current = true;
      useInteractionStore.getState().setSitting(true);
    };

    const moveRequest = useMoveTargetStore((state) => state.request);
    const lastHandledRequestId = useRef(0);

    useEffect(() => {
      if (!moveRequest || inputDisabled) return;
      // 입력 잠금 해제 시 과거 요청이 재실행되지 않도록 처리한 요청은 스킵
      if (moveRequest.requestId === lastHandledRequestId.current) return;
      lastHandledRequestId.current = moveRequest.requestId;

      // 앉은 상태에서 우클릭 이동 시 먼저 일어선 지점에서 길찾기 시작
      standUp();
      emoteRef.current = null;

      const start = {
        x: targetPosition.current.x,
        z: targetPosition.current.z,
      };

      // 길찾기 수행
      const computedPath = findPath(start, {
        x: moveRequest.x,
        z: moveRequest.z,
      });
      if (computedPath.length > 0) {
        pathRef.current = computedPath;
        pathIndexRef.current = 0;
        clickTarget.current = new THREE.Vector3(
          computedPath[0].x,
          0,
          computedPath[0].z,
        );
      }
    }, [moveRequest, inputDisabled, standUp]);

    useFrame((state, delta) => {
      if (!groupRef.current) return;

      const dt = Math.min(delta, MAX_DELTA);

      const keys = getKeys();
      const {
        forward,
        backward,
        left,
        right,
        run,
        jump,
        interact,
        emoteWave,
        emoteDance,
      } = inputDisabled
        ? {
            forward: false,
            backward: false,
            left: false,
            right: false,
            run: false,
            jump: false,
            interact: false,
            emoteWave: false,
            emoteDance: false,
          }
        : keys;

      // E 키 엣지 감지 + 모바일 버튼 토글 요청 수집
      const interactPressed = interact && !prevInteractRef.current;
      prevInteractRef.current = interact;
      const interaction = useInteractionStore.getState();
      const storeToggleRequested =
        interaction.toggleSitRequestId !== lastSitRequestIdRef.current;
      lastSitRequestIdRef.current = interaction.toggleSitRequestId;
      const toggleRequested =
        !inputDisabled && (interactPressed || storeToggleRequested);

      // 이모트 키(1/2) 엣지 감지 + EmoteBar 버튼 요청 수집
      const wavePressed = emoteWave && !prevEmoteKeysRef.current.wave;
      const dancePressed = emoteDance && !prevEmoteKeysRef.current.dance;
      prevEmoteKeysRef.current.wave = emoteWave;
      prevEmoteKeysRef.current.dance = emoteDance;
      let requestedEmote: string | null = wavePressed
        ? PLAYER_ANIM.WAVE
        : dancePressed
          ? PLAYER_ANIM.DANCE
          : null;
      const emoteRequest = interaction.emoteRequest;
      if (
        emoteRequest &&
        emoteRequest.requestId !== lastEmoteRequestIdRef.current
      ) {
        lastEmoteRequestIdRef.current = emoteRequest.requestId;
        if (!inputDisabled) requestedEmote = emoteRequest.anim;
      }

      const seat = seatRef.current;
      if (seat) {
        // 토글·이동·점프 입력 시 일어서기, 아니면 좌석에 고정
        if (toggleRequested || forward || backward || left || right || jump) {
          standUp();
        } else {
          targetPosition.current.set(seat.x, SIT_GROUP_Y, seat.z);
          targetRotation.current = seat.ry;
          playAction(PLAYER_ANIM.SIT, 0.35);
        }
      } else {
        // 벤치 근접 감지 (벤치 수가 적어 매 프레임 부담 없음)
        let nearby: number | null = null;
        let bestDistSq = SIT_RANGE * SIT_RANGE;
        for (let i = 0; i < BENCHES.length; i++) {
          const distSq =
            (BENCHES[i].x - targetPosition.current.x) ** 2 +
            (BENCHES[i].z - targetPosition.current.z) ** 2;
          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            nearby = i;
          }
        }
        interaction.setNearbyBench(nearby);

        // 방명록 게시판 근접 감지 (벤치 다음, 대나무보다 우선)
        const guestbook = useGuestbookStore.getState();
        let nearBoard: number | null = null;
        let bestBoardSq = Infinity;
        for (let i = 0; i < NOTICE_BOARDS.length; i++) {
          const board = NOTICE_BOARDS[i];
          const distSq =
            (board.x - targetPosition.current.x) ** 2 +
            (board.z - targetPosition.current.z) ** 2;
          if (distSq < board.range * board.range && distSq < bestBoardSq) {
            bestBoardSq = distSq;
            nearBoard = i;
          }
        }
        guestbook.setNearbyBoard(nearBoard);

        // 대나무 근접 감지 (수확된 줄기는 제외, 벤치가 우선)
        const harvestState = useHarvestStore.getState();
        let nearBamboo: number | null = null;
        let bestBambooSq = HARVEST_RANGE * HARVEST_RANGE;
        for (let i = 0; i < BAMBOO.length; i++) {
          if (harvestState.harvestedSet.has(i)) continue;
          const distSq =
            (BAMBOO[i].x - targetPosition.current.x) ** 2 +
            (BAMBOO[i].z - targetPosition.current.z) ** 2;
          if (distSq < bestBambooSq) {
            bestBambooSq = distSq;
            nearBamboo = i;
          }
        }
        harvestState.setNearbyBamboo(nearBamboo);
        const harvestButtonRequested =
          harvestState.harvestRequestId !== lastHarvestRequestIdRef.current;
        lastHarvestRequestIdRef.current = harvestState.harvestRequestId;
        const harvestRequested =
          !inputDisabled &&
          nearBamboo !== null &&
          (harvestButtonRequested ||
            (toggleRequested && nearby === null && nearBoard === null));

        if (toggleRequested && nearby !== null) {
          sitDown(nearby);
        } else if (toggleRequested && nearBoard !== null) {
          // 패널이 열리면 page.tsx가 입력을 잠그므로 여기서 더 할 일은 없다
          guestbook.open();
          clearClickPath();
        } else if (harvestRequested && nearBamboo !== null) {
          // 수확: 카운트 증가 + 폴짝 점프 + 팝 사운드
          harvestState.harvest(nearBamboo);
          audio.harvestPop();
          if (isGrounded.current) {
            velocityY.current = JUMP_FORCE * 0.45;
            isGrounded.current = false;
          }
        } else if (requestedEmote && isGrounded.current) {
          // 같은 이모트를 다시 요청하면 해제, 다른 이모트면 전환
          emoteRef.current =
            emoteRef.current === requestedEmote ? null : requestedEmote;
          clearClickPath();
        }
      }

      // 앉아 있는 동안에는 물리·이동을 건너뛰고 보간/전송만 수행
      if (!seatRef.current) {
        // 키보드 입력이 있으면 클릭 이동 취소
        if (forward || backward || left || right) {
          clearClickPath();
        }

        // 점프 및 중력 물리
        if (jump && isGrounded.current) {
          velocityY.current = JUMP_FORCE;
          isGrounded.current = false;
          emoteRef.current = null;
          audio.jump();
        }

        const currentY = targetPosition.current.y;

        if (!isGrounded.current) {
          velocityY.current += GRAVITY * dt;
          targetPosition.current.y += velocityY.current * dt;

          if (targetPosition.current.y <= 0) {
            targetPosition.current.y = 0;
            velocityY.current = 0;
            isGrounded.current = true;
            audio.land();
          }
        }

        // 이동 벡터 계산
        _moveDir.set(0, 0, 0);
        let isMoving = false;

        const speed = run ? RUN_SPEED : WALK_SPEED;
        const moveStep = speed * dt;

        // 키보드 이동 우선 체크
        const keyboardForward = (forward ? 1 : 0) - (backward ? 1 : 0);
        const keyboardRight = (right ? 1 : 0) - (left ? 1 : 0);

        if (keyboardForward !== 0 || keyboardRight !== 0) {
          _moveDir
            .addScaledVector(CAM_FORWARD, keyboardForward)
            .addScaledVector(CAM_RIGHT, keyboardRight)
            .normalize();
          isMoving = true;
        }
        // 클릭 이동 체크 (키보드 이동이 없을 때만)
        else if (clickTarget.current) {
          const dx = clickTarget.current.x - targetPosition.current.x;
          const dz = clickTarget.current.z - targetPosition.current.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          // 현재 목적지(경유지)에 도착했는지 확인
          // 낮은 fps에서 한 프레임 이동량이 커도 경유지를 지나치지 않도록 보정
          if (dist > Math.max(0.15, moveStep)) {
            _moveDir.set(dx, 0, dz).normalize();
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
              clearClickPath();
            }
          }
        }

        if (isMoving) {
          _moveDir.multiplyScalar(moveStep);

          // 충돌 체크 후 이동
          const nextX = targetPosition.current.x + _moveDir.x;
          const nextZ = targetPosition.current.z + _moveDir.z;

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

          // 발소리 — 실제 이동 거리 누적으로 보폭마다 재생
          if ((canMoveX || canMoveZ) && isGrounded.current) {
            stepDistRef.current += moveStep;
            if (stepDistRef.current >= (run ? 1.7 : 1.25)) {
              stepDistRef.current = 0;
              audio.footstep(run);
            }
          }

          // 클릭 이동 중인데 양쪽 다 막혔다면 목표 취소
          if (clickTarget.current && !canMoveX && !canMoveZ) {
            clearClickPath();
          }

          // 이동 방향으로 캐릭터 회전
          targetRotation.current = Math.atan2(_moveDir.x, _moveDir.z);

          // 애니메이션 전환 (이동 시 이모트 해제)
          emoteRef.current = null;
          // 걷기↔달리기 사이 전환은 발 위상이 유지되도록 짧게 페이드
          const current = getCurrentAction();
          const locoFade =
            current === PLAYER_ANIM.WALK || current === PLAYER_ANIM.RUN
              ? 0.15
              : 0.2;
          playAction(run ? PLAYER_ANIM.RUN : PLAYER_ANIM.WALK, locoFade);
        } else if (emoteRef.current) {
          playAction(emoteRef.current, 0.3);
        } else {
          // 정지 → idle은 여유 있게 페이드해 급정거 느낌을 줄임
          playAction(PLAYER_ANIM.IDLE, 0.25);
        }
      }

      // 위치 및 회전 부드럽게 보간 (프레임레이트 보정)
      const posT = frameLerp(0.15, dt);
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x,
        targetPosition.current.x,
        posT,
      );
      groupRef.current.position.y = targetPosition.current.y; // Y축은 즉시 반영 (물리)
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z,
        targetPosition.current.z,
        posT,
      );

      groupRef.current.rotation.y = lerpAngle(
        groupRef.current.rotation.y,
        targetRotation.current,
        frameLerp(0.12, dt),
      );
      groupRef.current.updateMatrixWorld();

      // 현재 존 판정 (변화 없으면 store가 no-op) + 미니맵용 위치 공유
      const zoneState = useZoneStore.getState();
      const zone = zoneAt(targetPosition.current.x, targetPosition.current.z);
      zoneState.setZone(zone?.id ?? null, zone?.name ?? null);
      zoneState.playerPos.x = groupRef.current.position.x;
      zoneState.playerPos.z = groupRef.current.position.z;
      zoneState.playerPos.ry = groupRef.current.rotation.y;

      // 네트워크 데이터 전송 최적화 (10fps + 변화 감지)
      lastUpdateRef.current += delta;
      if (lastUpdateRef.current > 0.1) {
        // 100ms 마다 체크 (요금 절감)
        const currentPos = groupRef.current.position;
        const currentRot = groupRef.current.rotation.y;
        const currentAnim = getCurrentAction();

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

      // 카메라 트래킹: OrbitControls의 target을 플레이어 쪽으로 이동시키고
      // 카메라도 같은 양만큼 이동시켜 사용자가 조작한 회전/줌을 유지
      const controls = state.controls;
      if (controls instanceof OrbitControlsImpl) {
        _camDelta
          .copy(groupRef.current.position)
          .sub(controls.target)
          .multiplyScalar(frameLerp(0.1, dt));
        controls.target.add(_camDelta);
        state.camera.position.add(_camDelta);
      }
    });

    return (
      <group ref={groupRef} dispose={null}>
        <PandaBody nodes={nodes} materials={materials} castShadow />
        <PandaNameTag id={id} nickname={nickname} />
      </group>
    );
  },
);

Player.displayName = "Player";
