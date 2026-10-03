import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { projectPublicSnapshot } from "@/lib/guestbook/codec";

/** Only a restricted public RPC is called; no admin credentials or user sessions. */
const getSnapshot = unstable_cache(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("snapshot_not_configured");
  const response = await fetch(`${url}/rest/v1/rpc/read_world_snapshot`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("snapshot_unavailable");
  const raw: unknown = await response.json();
  const notes = projectPublicSnapshot(raw);
  return { notes, savedAt: Date.now() };
}, ["panda-village-world-snapshot-v1"], { revalidate: 60 });

export async function GET() {
  try {
    return NextResponse.json(await getSnapshot(), { headers: { "Cache-Control": "public, max-age=30, stale-if-error=86400" } });
  } catch {
    return NextResponse.json({ error: "snapshot_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
