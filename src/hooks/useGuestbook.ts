"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GLOBAL_WORLD_KEY } from "@/hooks/useGlobalWorld";
import { MAX_NICKNAME_LENGTH } from "@/hooks/useMultiplayer";
import {
  GuestbookNote,
  NOTE_COST,
  useGuestbookStore,
} from "@/stores/guestbookStore";
import { useHarvestStore } from "@/stores/harvestStore";

/** 데이터베이스 `world_traces_body_length` 제약과 동일하게 유지 */
export const MAX_NOTE_LENGTH = 80;

/** 패널 목록에 불러오는 최대 쪽지 수 */
const FETCH_LIMIT = 50;

/** 실시간 신호가 몰릴 때 재조회를 합치는 지연 */
const SIGNAL_COALESCE_MS = 400;

const FALLBACK_NICKNAME = "이름 없는 판다";

/**
 * 임베드된 작성자 프로필은 다대일이라 객체 하나로 오지만,
 * 관계 해석이 달라질 가능성에 대비해 배열도 받아준다.
 */
const readNickname = (raw: unknown): string => {
  const profile = Array.isArray(raw) ? raw[0] : raw;
  if (typeof profile !== "object" || profile === null) return FALLBACK_NICKNAME;
  const nickname = (profile as { nickname?: unknown }).nickname;
  if (typeof nickname !== "string") return FALLBACK_NICKNAME;
  const trimmed = nickname.trim();
  return trimmed.length > 0
    ? trimmed.slice(0, MAX_NICKNAME_LENGTH)
    : FALLBACK_NICKNAME;
};

/** 데이터베이스 응답도 신뢰하지 않고 형상을 검증한다 */
const toNote = (raw: unknown): GuestbookNote | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;

  if (typeof row.id !== "string" || typeof row.author_id !== "string") {
    return null;
  }
  if (typeof row.body !== "string") return null;

  const body = row.body.trim();
  if (body.length === 0) return null;

  const parsed =
    typeof row.created_at === "string" ? Date.parse(row.created_at) : NaN;

  return {
    id: row.id,
    body: body.slice(0, MAX_NOTE_LENGTH),
    authorId: row.author_id,
    nickname: readNickname(row.world_profiles),
    createdAt: Number.isFinite(parsed) ? parsed : Date.now(),
  };
};

const getWriteErrorMessage = (error: unknown): string => {
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";

  if (message.includes("world_traces_body_length")) {
    return `쪽지는 1~${MAX_NOTE_LENGTH}자로 적어주세요.`;
  }
  if (
    message.includes("row-level security") ||
    message.includes("permission denied")
  ) {
    return "쪽지를 걸 권한이 없어요. 다시 입장해주세요.";
  }
  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("fetch")
  ) {
    return "서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.";
  }
  return "쪽지를 걸지 못했어요. 잠시 후 다시 시도해주세요.";
};

/**
 * 방명록 데이터 계층.
 *
 * 실시간 broadcast는 위조될 수 있으므로 "새 글이 있다"는 신호로만 쓰고
 * 내용은 항상 데이터베이스에서 다시 읽는다. 작성 재시도가 쪽지를 중복
 * 생성하지 않도록 client_request_id는 제출 한 건 동안 유지한다.
 */
export const useGuestbook = (
  placeId: string,
  userId: string | null,
  /** useMultiplayer가 올려주는 실시간 갱신 신호 */
  revision: number,
  /** 내 변경을 다른 방문자에게 알리는 broadcast */
  notifyPeers: () => void,
) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const pendingRequestIdRef = useRef<string | null>(null);
  const loadTokenRef = useRef(0);

  const load = useCallback(async () => {
    if (!userId || !placeId) return;

    const token = ++loadTokenRef.current;
    const setStatus = useGuestbookStore.getState().setStatus;
    if (useGuestbookStore.getState().status === "idle") {
      setStatus("loading");
    }

    const { data, error } = await supabase
      .from("world_traces")
      .select(
        "id, body, created_at, author_id, world_profiles!world_traces_author_profile_fk(nickname)",
      )
      .eq("world_key", GLOBAL_WORLD_KEY)
      .eq("place_id", placeId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(FETCH_LIMIT);

    // 늦게 도착한 응답이 최신 목록을 덮어쓰지 않도록 한다
    if (token !== loadTokenRef.current) return;

    if (error) {
      setStatus("error");
      return;
    }

    const notes = (Array.isArray(data) ? data : [])
      .map(toNote)
      .filter((note): note is GuestbookNote => note !== null);

    useGuestbookStore.getState().setNotes(notes);
    setStatus("ready");
  }, [placeId, userId]);

  // 최초 1회 + 실시간 신호마다 재조회 (신호가 몰리면 합쳐진다)
  useEffect(() => {
    if (!userId || !placeId) return;

    if (revision === 0) {
      void load();
      return;
    }

    const timer = setTimeout(() => void load(), SIGNAL_COALESCE_MS);
    return () => clearTimeout(timer);
  }, [userId, placeId, revision, load]);

  const submit = useCallback(
    async (rawBody: string): Promise<boolean> => {
      if (isSubmitting || !userId || !placeId) return false;

      const body = rawBody.trim();
      if (body.length === 0 || body.length > MAX_NOTE_LENGTH) {
        setWriteError(`쪽지는 1~${MAX_NOTE_LENGTH}자로 적어주세요.`);
        return false;
      }

      const harvest = useHarvestStore.getState();
      if (harvest.bambooCount < NOTE_COST) {
        setWriteError("죽순이 필요해요. 대나무 숲에서 죽순을 모아보세요.");
        return false;
      }

      setIsSubmitting(true);
      setWriteError(null);

      // 네트워크 재시도가 쪽지를 중복 생성하지 않도록 같은 키를 재사용한다
      const clientRequestId =
        pendingRequestIdRef.current ?? crypto.randomUUID();
      pendingRequestIdRef.current = clientRequestId;

      const { error } = await supabase.from("world_traces").insert({
        world_key: GLOBAL_WORLD_KEY,
        place_id: placeId,
        author_id: userId,
        body,
        client_request_id: clientRequestId,
      });

      // 23505 = unique_violation — 이전 시도가 이미 성공한 경우이므로 성공 처리
      const alreadyWritten =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505";

      if (error && !alreadyWritten) {
        setIsSubmitting(false);
        setWriteError(getWriteErrorMessage(error));
        return false;
      }

      // 23505였다면 이전 시도가 이미 커밋된 것이므로, 어느 쪽이든 쪽지는
      // 걸렸다. 값은 한 번만 치른다 (client_request_id가 재시도를 묶어준다).
      pendingRequestIdRef.current = null;
      harvest.spendBamboo(NOTE_COST);

      await load();
      notifyPeers();
      setIsSubmitting(false);
      return true;
    },
    [isSubmitting, userId, placeId, load, notifyPeers],
  );

  const remove = useCallback(
    async (noteId: string) => {
      if (!userId) return;

      // 낙관적 제거 — 실패하면 재조회로 되돌아온다
      const previous = useGuestbookStore.getState().notes;
      useGuestbookStore
        .getState()
        .setNotes(previous.filter((note) => note.id !== noteId));

      const { error } = await supabase
        .from("world_traces")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", noteId);

      if (error) {
        useGuestbookStore.getState().setNotes(previous);
        return;
      }

      notifyPeers();
    },
    [userId, notifyPeers],
  );

  return { submit, remove, isSubmitting, writeError, refresh: load };
};
