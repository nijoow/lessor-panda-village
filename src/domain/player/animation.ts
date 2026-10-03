import {
  PLAYER_ANIM,
  type EmoteAnim,
  type PlayerAnimType,
} from "@/constants/playerAnimations";

export function choosePlayerAnimation(
  sitting: boolean,
  moving: boolean,
  running: boolean,
  emote: EmoteAnim | null,
  previous: PlayerAnimType,
) {
  if (sitting) return { anim: PLAYER_ANIM.SIT, fade: 0.35 };
  if (moving)
    return {
      anim: running ? PLAYER_ANIM.RUN : PLAYER_ANIM.WALK,
      fade:
        previous === PLAYER_ANIM.WALK || previous === PLAYER_ANIM.RUN
          ? 0.15
          : 0.2,
    };
  if (emote) return { anim: emote, fade: 0.3 };
  return { anim: PLAYER_ANIM.IDLE, fade: 0.25 };
}
