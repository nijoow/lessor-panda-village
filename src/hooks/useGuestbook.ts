"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GLOBAL_WORLD_KEY } from "@/hooks/useGlobalWorld";
import { MAX_NOTE_LENGTH, NOTE_PAGE_SIZE, readNoteCache, toGuestbookNote, writeNoteCache } from "@/lib/guestbook";
import { GuestbookNote, NOTE_COST, useGuestbookStore } from "@/stores/guestbookStore";
import { useHarvestStore } from "@/stores/harvestStore";
export { MAX_NOTE_LENGTH } from "@/lib/guestbook";
const FIELDS = "id,body,created_at,author_id,author_nickname,author_color_key";

const writeMessage = (error: unknown): string => {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (message.includes("world_traces_rate_limit")) return "쪽지는 5초에 한 번 남길 수 있어. 잠시 후 다시 시도해봐.";
  if (message.includes("world_traces_body_length")) return `쪽지는 1~${MAX_NOTE_LENGTH}자로 적어줘.`;
  if (message.includes("row-level security") || message.includes("permission denied")) return "지금은 쪽지를 걸 수 없어. 마을에 다시 연결해봐.";
  return "쪽지를 걸지 못했어. 연결을 확인하고 다시 시도해봐.";
};

export const useGuestbook = (placeId: string, userId: string | null, revision: number, notifyPeers: () => void, options: { readOnly?: boolean } = {}) => {
  const readOnly = options.readOnly || !userId || !supabase;
  const isOpen = useGuestbookStore((state) => state.isOpen);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedMineOnly, setMineOnly] = useState(false);
  const mineOnly = selectedMineOnly && !readOnly;
  const [visibleNotes, setVisibleNotes] = useState<GuestbookNote[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const pending = useRef<{ id: string; body: string; userId: string; placeId: string } | null>(null);
  const submitting = useRef(false);
  const loadToken = useRef(0);
  const cursor = useRef<GuestbookNote | null>(null);
  const charged = useRef(new Set<string>());
  const queryIdentity = useRef("");

  const load = useCallback(async (older = false) => {
    if (!placeId) return;
    const token = ++loadToken.current;
    const state = useGuestbookStore.getState();
    const identity = `${placeId}:${userId ?? "guest"}:${mineOnly}:${readOnly}`;
    if (!older && identity !== queryIdentity.current) {
      queryIdentity.current = identity;
      const cached = mineOnly ? null : readNoteCache(placeId);
      setVisibleNotes(cached?.notes ?? []);
      setHasMore(false);
      if (cached) { state.setNotes(cached.notes); state.setCachedAt(cached.savedAt); }
    }
    if (older) setIsLoadingMore(true);
    else { state.setStatus("loading"); setIsLoadingMore(false); }
    try {
      let notes: GuestbookNote[];
      let fromSnapshot = false;
      let snapshotAt: number | null = null;
      let boardNotes: GuestbookNote[] | null = null;
      if (!readOnly && supabase && userId) {
        let query = supabase.from("world_traces").select(FIELDS).eq("world_key", GLOBAL_WORLD_KEY).eq("place_id", placeId).is("deleted_at", null).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(NOTE_PAGE_SIZE);
        if (mineOnly) query = query.eq("author_id", userId);
        if (older && cursor.current) {
          const last = cursor.current;
          query = query.or(`created_at.lt.${last.createdAtCursor},and(created_at.eq.${last.createdAtCursor},id.lt.${last.id})`);
        }
        const { data, error } = await query;
        if (error) throw error;
        notes = (data ?? []).map(toGuestbookNote).filter((note): note is GuestbookNote => note !== null);
        if (mineOnly && !older) {
          const board = await supabase.from("world_traces").select(FIELDS).eq("world_key", GLOBAL_WORLD_KEY).eq("place_id", placeId).is("deleted_at", null).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(NOTE_PAGE_SIZE);
          if (!board.error) boardNotes = (board.data ?? []).map(toGuestbookNote).filter((note): note is GuestbookNote => note !== null);
        }
      } else {
        const response = await fetch("/api/world-snapshot", { cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error("snapshot_unavailable");
        const result = await response.json();
        if (!Array.isArray(result.notes)) throw new Error("invalid_snapshot");
        notes = result.notes.map(toGuestbookNote).filter((note: GuestbookNote | null): note is GuestbookNote => note !== null);
        fromSnapshot = true;
        snapshotAt = typeof result.savedAt === "number" ? result.savedAt : Date.now();
      }
      if (token !== loadToken.current) return;
      cursor.current = notes.at(-1) ?? null;
      setHasMore(!fromSnapshot && notes.length === NOTE_PAGE_SIZE);
      setVisibleNotes((previous) => older ? [...previous, ...notes.filter((note) => !previous.some((item) => item.id === note.id))] : notes);
      if (!older && (!mineOnly || fromSnapshot || boardNotes)) {
        const latest = boardNotes ?? notes;
        state.setNotes(latest); writeNoteCache(placeId, latest, snapshotAt ?? Date.now());
      }
      state.setCachedAt(snapshotAt);
      state.setStatus("ready");
    } catch {
      if (token !== loadToken.current) return;
      const cached = !mineOnly && !older ? readNoteCache(placeId) : null;
      if (cached) { state.setNotes(cached.notes); setVisibleNotes(cached.notes); state.setCachedAt(cached.savedAt); }
      state.setStatus("error");
    } finally {
      if (token === loadToken.current) setIsLoadingMore(false);
    }
  }, [placeId, userId, mineOnly, readOnly]);

  useEffect(() => {
    const tokenRef = loadToken;
    const timer = setTimeout(() => void load(), revision ? 400 : 0);
    return () => { clearTimeout(timer); ++tokenRef.current; };
  }, [load, revision, isOpen]);

  const refresh = useCallback(() => load(), [load]);
  const loadOlder = useCallback(() => { if (hasMore && !isLoadingMore) return load(true); }, [hasMore, isLoadingMore, load]);
  const submit = useCallback(async (rawBody: string): Promise<boolean> => {
    if (submitting.current || readOnly || !supabase || !userId || !placeId) return false;
    const body = rawBody.trim();
    if (!body || body.length > MAX_NOTE_LENGTH) { setWriteError(`쪽지는 1~${MAX_NOTE_LENGTH}자로 적어줘.`); return false; }
    if (useHarvestStore.getState().bambooCount < NOTE_COST) { setWriteError("죽순이 필요해. 대나무 숲에서 죽순을 모아봐."); return false; }
    submitting.current = true;
    setIsSubmitting(true); setWriteError(null);
    if (pending.current?.body !== body || pending.current.userId !== userId || pending.current.placeId !== placeId) pending.current = { id: crypto.randomUUID(), body, userId, placeId };
    const request = pending.current;
    try {
      const { data, error } = await supabase.from("world_traces").insert({ world_key: GLOBAL_WORLD_KEY, place_id: placeId, author_id: userId, body, client_request_id: request.id }).select(FIELDS).single();
      let persisted = toGuestbookNote(data);
      if (error) {
        if (error.code !== "23505") throw error;
        // A unique violation alone is not proof that this exact request succeeded.
        const saved = await supabase.from("world_traces").select(`${FIELDS},place_id,world_key,deleted_at`).eq("author_id", userId).eq("client_request_id", request.id).maybeSingle();
        if (saved.error || !saved.data || saved.data.body !== body || saved.data.place_id !== placeId || saved.data.world_key !== GLOBAL_WORLD_KEY || saved.data.deleted_at !== null) throw saved.error ?? new Error("request_conflict");
        persisted = toGuestbookNote(saved.data);
      }
      if (!persisted) throw new Error("invalid_write_response");
      if (persisted) {
        const notes = [persisted, ...useGuestbookStore.getState().notes.filter((note) => note.id !== persisted.id)].sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id)).slice(0, NOTE_PAGE_SIZE);
        useGuestbookStore.getState().setNotes(notes);
        writeNoteCache(placeId, notes);
      }
      if (!charged.current.has(request.id)) { useHarvestStore.getState().spendBamboo(NOTE_COST); charged.current.add(request.id); }
      pending.current = null;
      await load(); notifyPeers(); return true;
    } catch (error) { setWriteError(writeMessage(error)); return false; }
    finally { submitting.current = false; setIsSubmitting(false); }
  }, [readOnly, userId, placeId, load, notifyPeers]);

  const remove = useCallback(async (noteId: string) => {
    if (readOnly || !supabase || !userId) return;
    setDeleteError(null);
    try {
      const { data, error } = await supabase.from("world_traces").update({ deleted_at: new Date().toISOString() }).eq("id", noteId).eq("author_id", userId).is("deleted_at", null).select("id");
      if (error || data?.length !== 1) throw error ?? new Error("not_deleted");
      // Keep the row visible until deletion is confirmed; failures need no rollback.
      const notes = useGuestbookStore.getState().notes.filter((note) => note.id !== noteId);
      useGuestbookStore.getState().setNotes(notes); writeNoteCache(placeId, notes);
      setVisibleNotes((previous) => previous.filter((note) => note.id !== noteId));
      notifyPeers();
    } catch { setDeleteError("쪽지를 지우지 못했어. 연결을 확인하고 다시 시도해봐."); }
  }, [readOnly, userId, placeId, notifyPeers]);

  return { submit, remove, isSubmitting, writeError, deleteError, refresh, loadOlder, hasMore, isLoadingMore, mineOnly, setMineOnly, visibleNotes };
};
