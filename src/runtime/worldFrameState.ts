import { PLAYER_ANIM, type PlayerAnimType } from "@/constants/playerAnimations";
import type { PlayerPose, Position3 } from "@/domain/player";

/** Stable read views for rAF consumers. Only this owner mutates their fields. */
export function createWorldFrameState() {
  const player = { x: 0, y: 0, z: 0, ry: 0, anim: PLAYER_ANIM.IDLE as PlayerAnimType, emoting: false };
  const shadows = { revision: 0, animationUntil: 0 };
  return {
    player: player as Readonly<PlayerPose & { emoting: boolean }>,
    shadows: shadows as Readonly<typeof shadows>,
    publishPlayer(position: Readonly<Position3>, ry: number, anim: PlayerAnimType, emoting: boolean, time: number) {
      if (player.anim !== anim) {
        shadows.revision += 1;
        shadows.animationUntil = time + 1.5;
      }
      player.x = position.x;
      player.y = position.y;
      player.z = position.z;
      player.ry = ry;
      player.anim = anim;
      player.emoting = emoting;
    },
    invalidateShadows() { shadows.revision += 1; },
    resetPlayer() {
      Object.assign(player, { x: 0, y: 0, z: 0, ry: 0, anim: PLAYER_ANIM.IDLE, emoting: false });
      shadows.animationUntil = 0;
      shadows.revision += 1;
    },
  };
}

export const worldFrameState = createWorldFrameState();
