"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { WorldSession } from "@/types/multiplayer";

export const GLOBAL_WORLD_KEY = "panda-village";

const NICKNAME_STORAGE_KEY = "panda-village:nickname";
const MAX_NICKNAME_LENGTH = 10;

const getEntryErrorMessage = (error: unknown): string => {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message.toLowerCase()
        : "";

  if (
    message.includes("anonymous sign-ins are disabled") ||
    message.includes("anonymous_provider_disabled")
  ) {
    return "현재 익명 입장이 비활성화되어 있어요. Supabase의 Anonymous 로그인을 켠 뒤 다시 시도해주세요.";
  }
  if (
    message.includes("nickname") ||
    message.includes("world_profiles_nickname_length")
  ) {
    return "닉네임은 1~10자로 입력해주세요.";
  }
  if (
    message.includes("row-level security") ||
    message.includes("permission denied")
  ) {
    return "공유 월드 프로필을 저장하지 못했어요. 잠시 후 다시 시도해주세요.";
  }
  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("fetch")
  ) {
    return "서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요.";
  }

  return "공유 월드에 입장하지 못했어요. 잠시 후 다시 시도해주세요.";
};

export const useGlobalWorld = () => {
  const [worldSession, setWorldSession] = useState<WorldSession | null>(null);
  const [savedNickname, setSavedNickname] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  useEffect(() => {
    const storedNickname = localStorage.getItem(NICKNAME_STORAGE_KEY) ?? "";
    const url = new URL(window.location.href);

    if (url.searchParams.has("room")) {
      url.searchParams.delete("room");
      window.history.replaceState({}, "", url);
    }

    sessionStorage.removeItem("panda-village:pending-room-id");
    setSavedNickname(storedNickname.slice(0, MAX_NICKNAME_LENGTH));
    setIsReady(true);
  }, []);

  const enterWorld = useCallback(
    async (rawNickname: string) => {
      if (isEntering) return;

      const nickname = rawNickname.trim();
      if (
        nickname.length === 0 ||
        nickname.length > MAX_NICKNAME_LENGTH
      ) {
        setEntryError("닉네임은 1~10자로 입력해주세요.");
        return;
      }

      setIsEntering(true);
      setEntryError(null);

      try {
        const {
          data: { session: existingSession },
          error: sessionError,
        } = await supabase.auth.getSession();
        let session = existingSession;

        if (sessionError) throw sessionError;

        if (!session) {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          session = data.session;
        }

        if (!session?.user) {
          throw new Error("authentication_required");
        }

        const { error: profileError } = await supabase
          .from("world_profiles")
          .upsert(
            {
              user_id: session.user.id,
              nickname,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );

        if (profileError) throw profileError;

        await supabase.realtime.setAuth(session.access_token);

        localStorage.setItem(NICKNAME_STORAGE_KEY, nickname);
        setSavedNickname(nickname);
        setWorldSession({
          userId: session.user.id,
          nickname,
          worldKey: GLOBAL_WORLD_KEY,
        });
      } catch (error) {
        setEntryError(getEntryErrorMessage(error));
      } finally {
        setIsEntering(false);
      }
    },
    [isEntering],
  );

  return {
    worldSession,
    savedNickname,
    isReady,
    isEntering,
    entryError,
    enterWorld,
  };
};
