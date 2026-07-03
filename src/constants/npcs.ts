/** 월드를 배회하는 NPC 판다 정의 */
export interface NpcSpec {
  id: string;
  name: string;
  /** 배회 반경의 중심 (스폰 지점) */
  home: { x: number; z: number; radius: number };
  /** 주기적으로 말풍선에 띄우는 대사 */
  phrases: string[];
  /** 배회 리듬용 시드 */
  seed: number;
}

export const NPCS: NpcSpec[] = [
  {
    id: "npc-chief",
    name: "촌장 판다",
    home: { x: -3, z: 1, radius: 7 },
    phrases: [
      "마을에 온 걸 환영하네!",
      "남쪽 들판 너머에 대나무 숲이 있다네.",
      "강가 산책로의 다리는 내 자랑이야.",
      "밤이 되면 석등이 참 예쁘지.",
    ],
    seed: 11,
  },
  {
    id: "npc-bamboo",
    name: "죽순이",
    home: { x: 33, z: 31, radius: 6 },
    phrases: [
      "여기 대나무가 제일 맛있어!",
      "바람 불면 대숲 소리 좀 들어봐~",
      "공터 벤치에서 낮잠 자기 좋아.",
    ],
    seed: 27,
  },
  {
    id: "npc-river",
    name: "강돌이",
    home: { x: -41, z: 26, radius: 5 },
    phrases: [
      "물수제비 하기 딱 좋은 날이야.",
      "다리 밑으로 물고기가 지나가!",
      "갈대밭에 숨는 거 좋아해~",
    ],
    seed: 43,
  },
];
