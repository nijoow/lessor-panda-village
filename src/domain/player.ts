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

export interface MoveRequest {
  x: number;
  z: number;
  requestId: number;
}

export const PLAYER_MOTION = {
  walkSpeed: 4.8,
  runSpeed: 7.2,
  gravity: -21.6,
  jumpForce: 8.4,
  maxDelta: 0.1,
  harvestRange: 1.9,
} as const;

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
