import { PLAYER_MOTION } from "@/domain/player";

export interface VerticalState {
  y: number;
  velocity: number;
  grounded: boolean;
}

export function advanceVertical(
  state: VerticalState,
  jump: boolean,
  dt: number,
) {
  let { y, velocity, grounded } = state;
  const jumped = jump && grounded;
  if (jumped) {
    velocity = PLAYER_MOTION.jumpForce;
    grounded = false;
  }
  let landed = false;
  if (!grounded) {
    velocity += PLAYER_MOTION.gravity * dt;
    y += velocity * dt;
    if (y <= 0) {
      y = 0;
      velocity = 0;
      grounded = true;
      landed = true;
    }
  }
  return { y, velocity, grounded, jumped, landed };
}

/** Screen directions follow the current camera's horizontal forward/right axes. */
export function cameraMovement(
  forward: number,
  right: number,
  dx: number,
  dz: number,
) {
  const cameraLength = Math.hypot(dx, dz);
  if (cameraLength < 0.001) return { x: 0, z: 0 };
  const x = (dx / cameraLength) * forward - (dz / cameraLength) * right;
  const z = (dz / cameraLength) * forward + (dx / cameraLength) * right;
  const length = Math.hypot(x, z);
  return length ? { x: x / length, z: z / length } : { x: 0, z: 0 };
}
