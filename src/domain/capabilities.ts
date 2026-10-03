import type {
  WorldSession,
  MultiplayerConnectionStatus,
} from "@/types/multiplayer";

export function worldCapabilities(
  session: WorldSession | null,
  status: MultiplayerConnectionStatus,
) {
  const authenticated = session?.mode === "online";
  return {
    authenticated,
    canWriteNotes: authenticated,
    canChat: authenticated && status === "connected",
    canMoveRemotely: authenticated && status === "connected",
  };
}
