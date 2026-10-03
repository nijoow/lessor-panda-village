import { NOTE_PAGE_SIZE, type GuestbookNote } from "@/domain/guestbook";
import { UUID_PATTERN as UUID } from "@/domain/world";
import { toGuestbookNote } from "./codec";

const CACHE_VERSION = 1;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
