import { WORLD_BOUNDS } from "@/constants/world";
import { PLAYER_ANIM, type PlayerAnimType } from "@/constants/playerAnimations";
import { GLOBAL_WORLD_KEY, MAX_CHAT_LENGTH, MAX_NICKNAME_LENGTH, UUID_PATTERN } from "@/domain/world";
import type { ChatMessage, PlayerState } from "@/types/multiplayer";

export const discoveryTopic = `world:${GLOBAL_WORLD_KEY}`;
export const playerTopic = (id: string) => `${discoveryTopic}:player:${id}`;
export const isPlayerId = (id: string) => UUID_PATTERN.test(id);
const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const coordinate = (value: unknown, min: number, max: number) => Math.max(min, Math.min(max, finite(value)));
const nickname = (value: unknown) => typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_NICKNAME_LENGTH) : "Unknown";
const animations = new Set<string>(Object.values(PLAYER_ANIM));
const animation = (value: unknown): PlayerAnimType => typeof value === "string" && animations.has(value) ? value as PlayerAnimType : PLAYER_ANIM.IDLE;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

/** Identity comes only from the authorized subscription topic, never the body. */
export function decodeMove(sender: string, payload: unknown, now: number): PlayerState | null {
  if (!isPlayerId(sender) || !record(payload)) return null;
  return {
    id: sender, nickname: nickname(payload.nickname),
    x: coordinate(payload.x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX),
    y: coordinate(payload.y, 0, 8), z: coordinate(payload.z, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ),
    ry: finite(payload.ry) % (Math.PI * 2), anim: animation(payload.anim), lastUpdated: now,
  };
}
export function decodeChat(sender: string, payload: unknown, now: number): ChatMessage | null {
  if (!isPlayerId(sender) || !record(payload) || typeof payload.message !== "string") return null;
  const message = payload.message.trim().slice(0, MAX_CHAT_LENGTH);
  return message ? { id: sender, nickname: nickname(payload.nickname), message, timestamp: now } : null;
}
