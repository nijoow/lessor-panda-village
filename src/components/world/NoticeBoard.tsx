"use client";

import { memo, useMemo } from "react";
import { Text } from "@react-three/drei";
import { NOTICE_BOARDS, NoticeBoardPlacement } from "@/constants/world";
import { BOARD_SLOT_COUNT, useGuestbookStore } from "@/stores/guestbookStore";
import { getNicknameColor } from "@/utils/color";

/**
 * 마을 방명록 게시판.
 *
 * 판에 걸리는 쪽지는 최근 BOARD_SLOT_COUNT장뿐이고, 전체 목록과 작성은
 * GuestbookPanel(UI)이 담당합니다. 여기서는 "사람이 다녀갔다"가 공간
 * 안에서 보이게 하는 역할만 합니다.
 *
 * 히어로 모델로 교체하기 전의 프리미티브 버전입니다 (docs/roadmap.md).
 */

const WOOD_DARK = "#6d4c36";
const WOOD_MID = "#8d6e63";
const WOOD_LIGHT = "#a1887f";
const PAPER = "#fdf6e3";

// 4열 x 3행. 판 앞면(local +z)에 손으로 꽂은 듯한 결정적 기울기를 준다.
const SLOT_COLUMNS = 4;
const SLOT_X = [-0.75, -0.25, 0.25, 0.75];
const SLOT_Y = [1.72, 1.35, 0.98];

interface SlotTransform {
  x: number;
  y: number;
  tilt: number;
}

const SLOTS: SlotTransform[] = Array.from(
  { length: BOARD_SLOT_COUNT },
  (_, i) => {
    const column = i % SLOT_COLUMNS;
    const row = Math.floor(i / SLOT_COLUMNS);
    return {
      x: SLOT_X[column],
      y: SLOT_Y[row] ?? SLOT_Y[SLOT_Y.length - 1],
      // 시드 없는 결정적 흔들림 — 매 렌더 같은 각도를 유지한다
      tilt: (((i * 37) % 11) - 5) * 0.018,
    };
  },
);

const Board = ({
  placement,
  isNight,
}: {
  placement: NoticeBoardPlacement;
  isNight: boolean;
}) => {
  const notes = useGuestbookStore((state) => state.notes);

  // 최근 글이 위 칸부터 걸리도록 앞에서 잘라 쓴다
  const pinned = useMemo(
    () => notes.slice(0, BOARD_SLOT_COUNT),
    [notes],
  );

  return (
    <group
      position={[placement.x, 0, placement.z]}
      rotation={[0, placement.rotation, 0]}
    >
      {/* 기둥 */}
      {[-1.05, 1.05].map((x) => (
        <mesh key={x} position={[x, 1.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.16, 2.1, 0.16]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.85} />
        </mesh>
      ))}

      {/* 판 */}
      <mesh position={[0, 1.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 1.35, 0.12]} />
        <meshStandardMaterial color={WOOD_MID} roughness={0.9} />
      </mesh>

      {/* 판 테두리 (위/아래 가로대) */}
      {[0.72, -0.72].map((dy) => (
        <mesh
          key={dy}
          position={[0, 1.35 + dy, 0.02]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[2.35, 0.12, 0.18]} />
          <meshStandardMaterial color={WOOD_LIGHT} roughness={0.85} />
        </mesh>
      ))}

      {/* 지붕 — 집과 같은 방향으로 살짝 기운 두 장 */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0, 2.28, side * 0.22]}
          rotation={[side * 0.42, 0, 0]}
          castShadow
        >
          <boxGeometry args={[2.7, 0.09, 0.62]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.8} />
        </mesh>
      ))}

      {/* 쪽지 — 작성자 색으로 구분되어 누가 다녀갔는지 한눈에 보인다 */}
      {pinned.map((note, i) => {
        const slot = SLOTS[i];
        return (
          <group
            key={note.id}
            position={[slot.x, slot.y, 0.075]}
            rotation={[0, 0, slot.tilt]}
          >
            <mesh castShadow>
              <boxGeometry args={[0.4, 0.3, 0.015]} />
              <meshStandardMaterial color={PAPER} roughness={0.95} />
            </mesh>
            {/* 작성자 색 머리띠 */}
            <mesh position={[0, 0.115, 0.012]}>
              <boxGeometry args={[0.4, 0.07, 0.012]} />
              <meshStandardMaterial
                color={getNicknameColor(note.authorId)}
                roughness={0.8}
              />
            </mesh>
          </group>
        );
      })}

      {/* 현판 */}
      <Text
        font="/fonts/Jua-Regular.ttf"
        position={[0, 2.02, 0.09]}
        fontSize={0.26}
        color="#4a3728"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor="#f6e7d2"
      >
        방명록
      </Text>

      {/* 밤 등불 — 게시판이 어둠에 묻히지 않게 */}
      <mesh position={[0, 1.98, 0.34]}>
        <boxGeometry args={[0.16, 0.2, 0.16]} />
        <meshStandardMaterial
          color={isNight ? "#ffd18c" : "#cfc3b4"}
          emissive={isNight ? "#ffb454" : "#000000"}
          emissiveIntensity={isNight ? 1.6 : 0}
          roughness={0.7}
        />
      </mesh>
    </group>
  );
};

export const NoticeBoards = memo(function NoticeBoards({
  isNight,
}: {
  isNight: boolean;
}) {
  return (
    <>
      {NOTICE_BOARDS.map((placement) => (
        <Board
          key={placement.placeId}
          placement={placement}
          isNight={isNight}
        />
      ))}
    </>
  );
});
