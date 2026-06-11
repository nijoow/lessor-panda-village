export const PLAYER_ANIM = {
  IDLE: 'Armature|clip0|baselayer',
  WALK: 'Armature|walking_man|baselayer',
  RUN: 'Armature|running|baselayer',
  SIT: 'sit',
} as const;

export type PlayerAnimType = typeof PLAYER_ANIM[keyof typeof PLAYER_ANIM];
