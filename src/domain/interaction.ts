export interface NearbyInteractions {
  sitting: boolean;
  bench: number | null;
  board: number | null;
  bamboo: number | null;
}

export type InteractionKind = "stand" | "sit" | "guestbook" | "harvest";

/** One priority policy for keyboard actions and the displayed UI action. */
export function chooseInteraction(
  nearby: NearbyInteractions,
): InteractionKind | null {
  if (nearby.sitting) return "stand";
  if (nearby.bench !== null) return "sit";
  if (nearby.board !== null) return "guestbook";
  if (nearby.bamboo !== null) return "harvest";
  return null;
}
