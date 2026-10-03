"use client";

import { useCallback, useState } from "react";
import { worldCapabilities } from "@/domain/capabilities";
import { useGlobalWorld } from "./useGlobalWorld";
import { useMultiplayer } from "./useMultiplayer";

/** Authentication and transport retain their owners; feature permissions are derived here. */
export function useVillageSession() {
  const world = useGlobalWorld();
  const [retryKey, setRetryKey] = useState(0);
  const { worldSession, reconnect } = world;
  const authenticated = worldSession?.mode === "online";
  const multiplayer = useMultiplayer(
    worldSession?.nickname ?? null,
    authenticated ? worldSession.worldKey : null,
    authenticated ? worldSession.userId : null,
    retryKey,
  );
  const capabilities = worldCapabilities(worldSession, multiplayer.connectionStatus);
  const reconnectWorld = useCallback(() => {
    if (!authenticated) void reconnect();
    else setRetryKey((key) => key + 1);
  }, [authenticated, reconnect]);
  return { ...world, ...multiplayer, capabilities, reconnectWorld };
}
