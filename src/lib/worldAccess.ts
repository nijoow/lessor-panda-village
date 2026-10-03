import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientDatabase } from "@/types/clientDatabase";

/** Resolves Auth and persists the visitor profile; transport authentication belongs to transport. */
export async function ensureWorldProfile(client: SupabaseClient<ClientDatabase>, nickname: string, isCurrent: () => boolean) {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  let session = data.session;
  if (!session) {
    const auth = await client.auth.signInAnonymously();
    if (auth.error) throw auth.error;
    session = auth.data.session;
  }
  if (!session || !isCurrent()) throw new Error("cancelled");
  const profile = await client.from("world_profiles").upsert({
    user_id: session.user.id, nickname, updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (profile.error) throw profile.error;
  if (!isCurrent()) throw new Error("cancelled");
  return session.user.id;
}
