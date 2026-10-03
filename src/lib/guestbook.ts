import { MAX_NOTE_LENGTH, NOTE_PAGE_SIZE, type GuestbookNote } from "@/domain/guestbook";
import { MAX_NICKNAME_LENGTH, UUID_PATTERN as UUID } from "@/domain/world";
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Public snapshots contain a palette index, never the author's account ID. */
export const toGuestbookNote = (raw: unknown): GuestbookNote | null => {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || !UUID.test(row.id) || typeof row.body !== "string") return null;
  const body = row.body.trim();
  const createdAt = typeof row.created_at === "string" ? Date.parse(row.created_at) : NaN;
  if (!body || body.length > MAX_NOTE_LENGTH || !Number.isFinite(createdAt)) return null;
  const authorId = typeof row.author_id === "string" && UUID.test(row.author_id) ? row.author_id : null;
  const nickname = typeof row.author_nickname === "string" ? row.author_nickname.trim().slice(0, MAX_NICKNAME_LENGTH) : "";
  const index = row.author_color_index;
  // 'd' ... 'm' have char codes 100 ... 109, mapping to palette indexes 0 ... 9.
  const publicColorKey = typeof index === "number" && Number.isInteger(index) && index >= 0 && index <= 9 ? String.fromCharCode(100 + index) : null;
  const colorKey = typeof row.author_color_key === "string" && UUID.test(row.author_color_key) ? row.author_color_key : publicColorKey ?? authorId ?? row.id;
  return { id: row.id, body, authorId, nickname: nickname || "이름 없는 판다", colorKey, createdAt, createdAtCursor: row.created_at as string };
};

export const readNoteCache = (placeId: string): { notes: GuestbookNote[]; savedAt: number } | null => {
  try {
    const raw = JSON.parse(localStorage.getItem(`panda-village:notes:${placeId}`) ?? "null");
    if (!raw || raw.version !== CACHE_VERSION || typeof raw.savedAt !== "number" || Date.now() - raw.savedAt > CACHE_TTL_MS || raw.savedAt > Date.now() || !Array.isArray(raw.notes)) return null;
    const notes = raw.notes.slice(0, NOTE_PAGE_SIZE).map(toGuestbookNote).filter((note: GuestbookNote | null): note is GuestbookNote => note !== null);
    return { notes, savedAt: raw.savedAt };
  } catch { return null; }
};

export const writeNoteCache = (placeId: string, notes: GuestbookNote[], savedAt = Date.now()) => {
  try {
    localStorage.setItem(`panda-village:notes:${placeId}`, JSON.stringify({ version: CACHE_VERSION, savedAt, notes: notes.slice(0, NOTE_PAGE_SIZE).map((note) => ({ id: note.id, body: note.body, author_id: note.authorId, author_nickname: note.nickname, author_color_key: UUID.test(note.colorKey) ? note.colorKey : undefined, author_color_index: note.colorKey.length === 1 ? note.colorKey.charCodeAt(0) - 100 : undefined, created_at: note.createdAtCursor })) }));
  } catch { /* Storage may be disabled or full; database remains authoritative. */ }
};
