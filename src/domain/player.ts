import type { PlayerAnimType } from "@/constants/playerAnimations";

export interface Position3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerPose extends Position3 {
  ry: number;
  anim: PlayerAnimType;
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
