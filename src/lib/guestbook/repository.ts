import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientDatabase } from "@/types/clientDatabase";
import { GLOBAL_WORLD_KEY } from "@/domain/world";
import { NOTE_PAGE_SIZE, type GuestbookNote } from "@/domain/guestbook";
import { supabase } from "@/lib/supabase";
import { toGuestbookNote } from "./codec";

const FIELDS = "id,body,created_at,author_id,author_nickname,author_color_key";

export interface NoteRequest {
  id: string;
  body: string;
  userId: string;
  placeId: string;
}

export interface GuestbookRepository {
  canWrite: boolean;
  readPage(
    placeId: string,
    authorId?: string,
    cursor?: GuestbookNote | null,
  ): Promise<GuestbookNote[]>;
  readSnapshot(): Promise<{ notes: GuestbookNote[]; savedAt: number }>;
  create(request: NoteRequest): Promise<GuestbookNote>;
  remove(noteId: string, userId: string): Promise<void>;
}

const decodeNotes = (rows: unknown[]) =>
  rows
    .map(toGuestbookNote)
    .filter((note): note is GuestbookNote => note !== null);

export function createGuestbookRepository(
  client: SupabaseClient<ClientDatabase> | null,
): GuestbookRepository {
  const database = () => {
    if (!client) throw new Error("database_unavailable");
    return client;
  };
  const activeNotes = (placeId: string) =>
    database()
      .from("world_traces")
      .select(FIELDS)
      .eq("world_key", GLOBAL_WORLD_KEY)
      .eq("place_id", placeId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(NOTE_PAGE_SIZE);

  return {
    canWrite: client !== null,
    async readPage(placeId, authorId, cursor) {
      let query = activeNotes(placeId);
      if (authorId) query = query.eq("author_id", authorId);
      if (cursor)
        query = query.or(
          `created_at.lt.${cursor.createdAtCursor},and(created_at.eq.${cursor.createdAtCursor},id.lt.${cursor.id})`,
        );
      const { data, error } = await query;
      if (error) throw error;
      return decodeNotes(data ?? []);
    },
    async readSnapshot() {
      const response = await fetch("/api/world-snapshot", {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("snapshot_unavailable");
      const raw: unknown = await response.json();
      if (
        !raw ||
        typeof raw !== "object" ||
        !("notes" in raw) ||
        !Array.isArray(raw.notes)
      )
        throw new Error("invalid_snapshot");
      const savedAt =
        "savedAt" in raw &&
        typeof raw.savedAt === "number" &&
        Number.isFinite(raw.savedAt)
          ? raw.savedAt
          : Date.now();
      return { notes: decodeNotes(raw.notes), savedAt };
    },
    async create(request) {
      const { data, error } = await database()
        .from("world_traces")
        .insert({
          world_key: GLOBAL_WORLD_KEY,
          place_id: request.placeId,
          author_id: request.userId,
          body: request.body,
          client_request_id: request.id,
        })
        .select(FIELDS)
        .single();
      let row: unknown = data;
      if (error) {
        if (error.code !== "23505") throw error;
        // A conflict proves success only for the exact same immutable request.
        const saved = await database()
          .from("world_traces")
          .select(`${FIELDS},place_id,world_key,deleted_at`)
          .eq("author_id", request.userId)
          .eq("client_request_id", request.id)
          .maybeSingle();
        if (
          saved.error ||
          !saved.data ||
          saved.data.body !== request.body ||
          saved.data.place_id !== request.placeId ||
          saved.data.world_key !== GLOBAL_WORLD_KEY ||
          saved.data.deleted_at !== null
        ) {
          throw saved.error ?? new Error("request_conflict");
        }
        row = saved.data;
      }
      const note = toGuestbookNote(row);
      if (!note) throw new Error("invalid_write_response");
      return note;
    },
    async remove(noteId, userId) {
      const { data, error } = await database()
        .from("world_traces")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", noteId)
        .eq("author_id", userId)
        .is("deleted_at", null)
        .select("id");
      if (error || data?.length !== 1) throw error ?? new Error("not_deleted");
    },
  };
}

export const guestbookRepository = createGuestbookRepository(supabase);
