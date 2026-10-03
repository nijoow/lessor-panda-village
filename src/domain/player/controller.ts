import { PLAYER_ANIM, type EmoteAnim } from "@/constants/playerAnimations";
import { BENCH_SPEC } from "@/constants/world/objects";
import {
  Controls,
  PLAYER_MOTION,
  type PlayerPose,
  type MoveRequest,
} from "@/domain/player";
import { chooseInteraction } from "@/domain/interaction";
import type { Point, CollisionCheck } from "@/utils/pathfinder";
import { frameLerp, lerpAngle } from "@/utils/math";
import { advanceVertical, cameraMovement } from "./movement";
import { nearbyObjects, nearestSeat, type PlayerWorld } from "./proximity";
import { choosePlayerAnimation } from "./animation";

export type PlayerKeys = Record<Controls, boolean>;
export const EMPTY_PLAYER_KEYS: PlayerKeys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  run: false,
  jump: false,
  interact: false,
  emoteWave: false,
  emoteDance: false,
};

interface Commands {
  move: MoveRequest | null;
  sit: number;
  harvest: number;
  emote: { requestId: number; anim: EmoteAnim } | null;
}

interface FrameInput {
  delta: number;
  camera: { x: number; z: number };
  keys: PlayerKeys;
  disabled: boolean;
  commands: Commands;
}

export type PlayerEvent =
  | { kind: "jump" | "land" | "guestbook" }
  | { kind: "footstep"; running: boolean }
  | { kind: "harvest"; index: number };

interface Environment extends PlayerWorld {
  collision: CollisionCheck;
  findPath: (start: Point, end: Point) => Point[];
}

/** Deterministic frame controller. Its adapters own rendering, stores, sound and transport. */
export class PlayerController {
  private target = { x: 0, y: 0, z: 0, ry: 0 };
  private pose: PlayerPose = {
    x: 0,
    y: 0,
    z: 0,
    ry: 0,
    anim: PLAYER_ANIM.IDLE,
  };
  private vertical = { y: 0, velocity: 0, grounded: true };
  private seat: ReturnType<typeof nearestSeat> | null = null;
  private emote: EmoteAnim | null = null;
  private path: Point[] = [];
  private pathIndex = 0;
  private stepDistance = 0;
  private previousKeys = { interact: false, wave: false, dance: false };
  private consumed = { move: 0, sit: 0, harvest: 0, emote: 0 };
  private events: PlayerEvent[] = [];
  private nearby = {
    bench: null as number | null,
    board: null as number | null,
    bamboo: null as number | null,
  };

  constructor(private readonly world: Environment) {}

  private clearPath() {
    this.path = [];
    this.pathIndex = 0;
  }
  private stand() {
    if (!this.seat) return;
    this.target.x =
      this.seat.x + Math.sin(this.seat.ry) * BENCH_SPEC.standOffset;
    this.target.z =
      this.seat.z + Math.cos(this.seat.ry) * BENCH_SPEC.standOffset;
    this.target.y = 0;
    this.vertical = { y: 0, velocity: 0, grounded: true };
    this.seat = null;
  }

  step(input: FrameInput) {
    const dt = Number.isFinite(input.delta)
      ? Math.max(0, Math.min(input.delta, PLAYER_MOTION.maxDelta))
      : 0;
    this.events.length = 0;
    const { commands } = input;
    const keys = input.disabled ? EMPTY_PLAYER_KEYS : input.keys;
    const toggle =
      !input.disabled &&
      ((keys.interact && !this.previousKeys.interact) ||
        commands.sit !== this.consumed.sit);
    const harvest =
      !input.disabled && commands.harvest !== this.consumed.harvest;
    let requestedEmote: EmoteAnim | null =
      keys.emoteWave && !this.previousKeys.wave
        ? PLAYER_ANIM.WAVE
        : keys.emoteDance && !this.previousKeys.dance
          ? PLAYER_ANIM.DANCE
          : null;
    if (
      commands.emote &&
      commands.emote.requestId !== this.consumed.emote &&
      !input.disabled
    )
      requestedEmote = commands.emote.anim;
    this.previousKeys = {
      interact: input.keys.interact,
      wave: input.keys.emoteWave,
      dance: input.keys.emoteDance,
    };
    this.consumed.sit = commands.sit;
    this.consumed.harvest = commands.harvest;
    this.consumed.emote = commands.emote?.requestId ?? 0;
    if (commands.move && commands.move.requestId !== this.consumed.move) {
      this.consumed.move = commands.move.requestId;
      this.clearPath();
      if (!input.disabled) {
        this.stand();
        this.emote = null;
        this.path = this.world.findPath(this.target, commands.move);
      }
    }
    if (input.disabled) this.clearPath();
    const keyboardMoving =
      keys.forward || keys.backward || keys.left || keys.right;

    if (this.seat) {
      if (toggle || keyboardMoving || keys.jump) this.stand();
      else {
        this.target.x = this.seat.x;
        this.target.y = BENCH_SPEC.groupY;
        this.target.z = this.seat.z;
        this.target.ry = this.seat.ry;
      }
    } else {
      this.nearby = nearbyObjects(this.world, this.target.x, this.target.z);
      const active = chooseInteraction({ sitting: false, ...this.nearby });
      const action =
        !input.disabled && (toggle || (harvest && active === "harvest"))
          ? active
          : null;
      if (action === "sit" && this.nearby.bench !== null) {
        this.seat = nearestSeat(
          this.world.benches[this.nearby.bench],
          this.target.x,
          this.target.z,
        );
        this.clearPath();
        this.emote = null;
        this.vertical = { y: 0, velocity: 0, grounded: true };
      } else if (action === "guestbook") {
        this.events.push({ kind: "guestbook" });
        this.clearPath();
      } else if (action === "harvest" && this.nearby.bamboo !== null) {
        this.events.push({ kind: "harvest", index: this.nearby.bamboo });
        if (this.vertical.grounded)
          this.vertical = {
            y: this.target.y,
            velocity: PLAYER_MOTION.jumpForce * 0.45,
            grounded: false,
          };
      } else if (requestedEmote && this.vertical.grounded) {
        this.emote = this.emote === requestedEmote ? null : requestedEmote;
        this.clearPath();
      }
    }

    let moving = false;
    if (!this.seat) {
      if (keyboardMoving) this.clearPath();
      const vertical = advanceVertical(this.vertical, keys.jump, dt);
      this.vertical = vertical;
      this.target.y = vertical.y;
      if (vertical.jumped) {
        this.events.push({ kind: "jump" });
        this.emote = null;
      }
      if (vertical.landed) this.events.push({ kind: "land" });
      let direction = { x: 0, z: 0 };
      const step =
        (keys.run ? PLAYER_MOTION.runSpeed : PLAYER_MOTION.walkSpeed) * dt;
      const forward = Number(keys.forward) - Number(keys.backward);
      const right = Number(keys.right) - Number(keys.left);
      if (forward || right)
        direction = cameraMovement(
          forward,
          right,
          this.pose.x - input.camera.x,
          this.pose.z - input.camera.z,
        );
      else {
        const point = this.path[this.pathIndex];
        if (point) {
          const dx = point.x - this.target.x,
            dz = point.z - this.target.z;
          const distance = Math.hypot(dx, dz);
          if (distance > Math.max(0.15, step))
            direction = { x: dx / distance, z: dz / distance };
          else if (++this.pathIndex >= this.path.length) this.clearPath();
        }
      }
      moving = direction.x !== 0 || direction.z !== 0;
      if (moving) {
        const nextX = this.target.x + direction.x * step,
          nextZ = this.target.z + direction.z * step;
        const canX = !this.world.collision(nextX, this.target.z, this.target.y);
        if (canX) this.target.x = nextX;
        // Validate Z after the accepted X step: individually clear axis probes
        // can combine into a blocked diagonal destination at an obstacle corner.
        const canZ = !this.world.collision(this.target.x, nextZ, this.target.y);
        if (canZ) this.target.z = nextZ;
        const traveled = Math.hypot(
          canX ? direction.x * step : 0,
          canZ ? direction.z * step : 0,
        );
        if (traveled > 0 && vertical.grounded) {
          this.stepDistance += traveled;
          if (this.stepDistance >= (keys.run ? 1.7 : 1.25)) {
            this.stepDistance = 0;
            this.events.push({ kind: "footstep", running: keys.run });
          }
        }
        if (this.path.length && dt > 0 && traveled === 0) this.clearPath();
        this.target.ry = Math.atan2(direction.x, direction.z);
        this.emote = null;
      }
    }
    const animation = choosePlayerAnimation(
      this.seat !== null,
      moving,
      keys.run,
      this.emote,
      this.pose.anim,
    );
    const t = frameLerp(0.15, dt);
    this.pose.x += (this.target.x - this.pose.x) * t;
    this.pose.y = this.target.y;
    this.pose.z += (this.target.z - this.pose.z) * t;
    this.pose.ry = lerpAngle(this.pose.ry, this.target.ry, frameLerp(0.12, dt));
    this.pose.anim = animation.anim;
    return {
      pose: this.pose as Readonly<PlayerPose>,
      nearby: this.nearby as Readonly<ReturnType<typeof nearbyObjects>>,
      sitting: this.seat !== null,
      emoting: this.emote !== null,
      events: this.events as readonly PlayerEvent[],
      animation,
    };
  }
}
