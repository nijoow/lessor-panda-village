"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { NOTE_COST } from "@/domain/guestbook";
import { readNoteCache } from "@/lib/guestbook/cache";
import { applyBoardSnapshot, confirmNoteDeletion, confirmNoteWrite } from "@/lib/guestbook/boardState";
import { guestbookRepository } from "@/lib/guestbook/repository";
import { GuestbookSession } from "@/lib/guestbook/session";
import { useGuestbookStore } from "@/stores/guestbookStore";
import { useHarvestStore } from "@/stores/harvestStore";

export const useGuestbook = (placeId: string, userId: string | null, revision: number, notifyPeers: () => void, options: { readOnly?: boolean } = {}) => {
  const readOnly = Boolean(options.readOnly || !userId || !guestbookRepository.canWrite);
  const isOpen = useGuestbookStore((state) => state.isOpen);
  const query = useMemo(() => new GuestbookSession({ placeId, userId, readOnly }, {
    repository: guestbookRepository,
    readCache: () => readNoteCache(placeId),
    applyBoard: (notes, status, cachedAt, persist) => applyBoardSnapshot(placeId, notes, status, cachedAt, persist),
    setBoardStatus: (status) => useGuestbookStore.getState().setStatus(status),
    confirmWrite: (note) => confirmNoteWrite(placeId, note),
    confirmDeletion: (noteId) => confirmNoteDeletion(placeId, noteId),
    canAfford: () => useHarvestStore.getState().bambooCount >= NOTE_COST,
    charge: () => { useHarvestStore.getState().spendBamboo(NOTE_COST); },
    notifyPeers,
  }), [placeId, userId, readOnly, notifyPeers]);
  const state = useSyncExternalStore(query.subscribe, query.getSnapshot, query.getSnapshot);

  useEffect(() => {
    query.activate();
    return query.deactivate;
  }, [query]);
  useEffect(() => {
    const timer = setTimeout(() => void query.refresh(), revision ? 400 : 0);
    return () => { clearTimeout(timer); query.cancelReads(); };
  }, [query, revision, isOpen]);

  return {
    ...state, submit: query.submit, remove: query.remove, refresh: query.refresh,
    loadOlder: query.loadOlder, setMineOnly: query.setMineOnly,
  };
};
