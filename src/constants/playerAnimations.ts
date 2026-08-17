export const PLAYER_ANIM = {
  IDLE: "idle",
  WALK: "Armature|walking_man|baselayer",
  RUN: "Armature|running|baselayer",
  SIT: "sit",
  WAVE: "wave",
  DANCE: "dance",
} as const;

export type PlayerAnimType = (typeof PLAYER_ANIM)[keyof typeof PLAYER_ANIM];

/**
 * 클립 재생 속도 배율.
 * 걷기/달리기 클립의 발 접지 속도(약 1.8 / 4.2 units/s)가 실제 이동
 * 속도(4.8 / 7.2 units/s)보다 느려 발이 미끄러져 보이므로 가속해서
 * 보폭을 맞춘다 (scripts 진단: diagnose-clip-speed 기준).
 */
export const PLAYER_ANIM_TIMESCALE: Partial<Record<PlayerAnimType, number>> = {
  [PLAYER_ANIM.WALK]: 2.0,
  [PLAYER_ANIM.RUN]: 1.7,
};

/** UI(EmoteBar)와 Player가 공유하는 이모트 목록 */
export const EMOTES = [
  { anim: PLAYER_ANIM.WAVE, label: "인사", icon: "👋" },
  { anim: PLAYER_ANIM.DANCE, label: "춤", icon: "🕺" },
] as const;

export type EmoteAnim = (typeof EMOTES)[number]["anim"];
