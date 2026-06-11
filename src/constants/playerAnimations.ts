export const PLAYER_ANIM = {
  IDLE: 'Armature|clip0|baselayer',
  WALK: 'Armature|walking_man|baselayer',
  RUN: 'Armature|running|baselayer',
  SIT: 'sit',
  WAVE: 'wave',
  DANCE: 'dance',
} as const;

/** UI(EmoteBar)와 Player가 공유하는 이모트 목록 */
export const EMOTES = [
  { anim: PLAYER_ANIM.WAVE, label: '인사', icon: '👋' },
  { anim: PLAYER_ANIM.DANCE, label: '춤', icon: '🕺' },
] as const;

export type EmoteAnim = (typeof EMOTES)[number]['anim'];

export type PlayerAnimType = typeof PLAYER_ANIM[keyof typeof PLAYER_ANIM];
