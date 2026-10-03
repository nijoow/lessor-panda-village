import { textLength, truncateText } from "@/domain/text";
import {
  MAX_NOTE_LENGTH,
  NOTE_PAGE_SIZE,
  type GuestbookNote,
} from "@/domain/guestbook";
import { MAX_NICKNAME_LENGTH, UUID_PATTERN as UUID } from "@/domain/world";
import type { Database } from "@/types/database";

type PublicSnapshotRow =
  Database["public"]["Functions"]["read_world_snapshot"]["Returns"][number];

/** A checked, bounded public projection; extra RPC columns never leave the server. */
export function projectPublicSnapshot(raw: unknown): PublicSnapshotRow[] {
  if (!Array.isArray(raw)) throw new Error("invalid_snapshot");
  return raw.slice(0, NOTE_PAGE_SIZE).map((value: unknown) => {
    if (!value || typeof value !== "object")
      throw new Error("invalid_snapshot_row");
    const row = value as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      typeof row.body !== "string" ||
      !row.body.trim() ||
      textLength(row.body) > MAX_NOTE_LENGTH ||
      typeof row.created_at !== "string" ||
      !Number.isFinite(Date.parse(row.created_at)) ||
      typeof row.author_nickname !== "string" ||
      !row.author_nickname.trim() ||
      textLength(row.author_nickname) > MAX_NICKNAME_LENGTH ||
      typeof row.author_color_index !== "number" ||
      !Number.isInteger(row.author_color_index) ||
      row.author_color_index < 0 ||
      row.author_color_index > 9
    ) {
      throw new Error("invalid_snapshot_row");
    }
    return {
      id: row.id,
      body: row.body,
      created_at: row.created_at,
      author_nickname: row.author_nickname,
      author_color_index: row.author_color_index,
    };
  });
}
/** Public snapshots contain a palette index, never the author's account ID. */
export const toGuestbookNote = (raw: unknown): GuestbookNote | null => {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    !UUID.test(row.id) ||
    typeof row.body !== "string"
  )
    return null;
  const body = row.body.trim();
  const createdAt =
    typeof row.created_at === "string" ? Date.parse(row.created_at) : NaN;
  if (
    !body ||
    textLength(body) > MAX_NOTE_LENGTH ||
    !Number.isFinite(createdAt)
  )
    return null;
  const authorId =
    typeof row.author_id === "string" && UUID.test(row.author_id)
      ? row.author_id
      : null;
  const nickname =
    typeof row.author_nickname === "string"
      ? truncateText(row.author_nickname.trim(), MAX_NICKNAME_LENGTH)
      : "";
  const index = row.author_color_index;
  // 'd' ... 'm' have char codes 100 ... 109, mapping to palette indexes 0 ... 9.
  const publicColorKey =
    typeof index === "number" &&
    Number.isInteger(index) &&
    index >= 0 &&
    index <= 9
      ? String.fromCharCode(100 + index)
      : null;
  const colorKey =
    typeof row.author_color_key === "string" && UUID.test(row.author_color_key)
      ? row.author_color_key
      : (publicColorKey ?? authorId ?? row.id);
  return {
    id: row.id,
    body,
    authorId,
    nickname: nickname || "이름 없는 판다",
    colorKey,
    createdAt,
    createdAtCursor: row.created_at as string,
  };
};
