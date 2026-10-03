import { NOTE_PAGE_SIZE, type GuestbookNote, type GuestbookStatus } from "@/domain/guestbook";
import { useGuestbookStore } from "@/stores/guestbookStore";
import { writeNoteCache } from "./cache";

/** The board projection and its persistent fallback share a single mutation owner. */
export function applyBoardSnapshot(placeId: string, notes: GuestbookNote[], status: GuestbookStatus, cachedAt: number | null, persist = false) {
  if (persist) writeNoteCache(placeId, notes, cachedAt ?? Date.now());
  useGuestbookStore.getState().applySnapshot(notes, status, cachedAt);
}

export function confirmNoteWrite(placeId: string, note: GuestbookNote) {
  const notes = [note, ...useGuestbookStore.getState().notes.filter((item) => item.id !== note.id)]
    .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id)).slice(0, NOTE_PAGE_SIZE);
  applyBoardSnapshot(placeId, notes, "ready", null, true);
}

export function confirmNoteDeletion(placeId: string, noteId: string) {
  const state = useGuestbookStore.getState();
  applyBoardSnapshot(placeId, state.notes.filter((note) => note.id !== noteId), state.status, state.cachedAt, true);
}
