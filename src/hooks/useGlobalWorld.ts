"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ensureWorldProfile } from "@/lib/worldAccess";
import { supabase } from "@/lib/supabase";
import { WorldSession } from "@/types/multiplayer";

import { GLOBAL_WORLD_KEY, MAX_NICKNAME_LENGTH } from "@/domain/world";
const NICKNAME_STORAGE_KEY = "panda-village:nickname";

export const useGlobalWorld = () => {
  const [worldSession, setWorldSession] = useState<WorldSession | null>(null);
  const [savedNickname, setSavedNickname] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const sessionRef = useRef<WorldSession | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        setSavedNickname((localStorage.getItem(NICKNAME_STORAGE_KEY) ?? "").slice(0, MAX_NICKNAME_LENGTH));
      } catch { /* 저장소가 차단돼도 방문은 가능하다. */ }
      setIsReady(true);
    });
    return () => { cancelled = true; generation.current += 1; };
  }, []);

  const reconnect = useCallback(async () => {
    const visitor = sessionRef.current;
    if (!visitor || busy.current || !supabase) return;
    const client = supabase;
    busy.current = true;
    setIsEntering(true);
    const attempt = ++generation.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const userId = await Promise.race([
        ensureWorldProfile(client, visitor.nickname, () => attempt === generation.current),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), 6000);
        }),
      ]);
      if (attempt !== generation.current) return;
      const connected: WorldSession = { ...visitor, userId, mode: "online" };
      sessionRef.current = connected;
      setWorldSession(connected);
    } catch {
      if (attempt !== generation.current) return;
      // 인증 실패가 산책을 중단시키지는 않는다.
      const offline: WorldSession = { ...visitor, mode: "offline" };
      sessionRef.current = offline;
      setWorldSession(offline);
    } finally {
      clearTimeout(timer);
      if (attempt === generation.current) {
        generation.current += 1;
        busy.current = false;
        setIsEntering(false);
      }
    }
  }, []);

  const enterWorld = useCallback(async (rawNickname: string) => {
    const nickname = rawNickname.trim();
    if (!nickname || nickname.length > MAX_NICKNAME_LENGTH) {
      setEntryError("닉네임은 1~10자로 적어줘.");
      return;
    }
    if (sessionRef.current) return;
    const local: WorldSession = {
      userId: `local-${crypto.randomUUID()}`,
      nickname,
      worldKey: GLOBAL_WORLD_KEY,
      mode: "offline",
    };
    sessionRef.current = local;
    setWorldSession(local);
    setSavedNickname(nickname);
    setEntryError(null);
    try { localStorage.setItem(NICKNAME_STORAGE_KEY, nickname); } catch { /* 선택적 저장 */ }
    void reconnect();
  }, [reconnect]);

  useEffect(() => {
    const recover = () => {
      if (sessionRef.current?.mode === "offline") void reconnect();
    };
    window.addEventListener("online", recover);
    return () => window.removeEventListener("online", recover);
  }, [reconnect]);

  return { worldSession, savedNickname, isReady, isEntering, entryError, enterWorld, reconnect };
};
