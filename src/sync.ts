// Sync of routines and own figures across devices through Supabase (one JSON row per
// user, protected by row level security – see supabase/schema.sql). Each device keeps
// working offline with localStorage; a sync merges both sides item by item: the newer
// `updatedAt` wins, a deletion wins over older edits.
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./syncConfig";
import type { Routine } from "./routines";
import type { CustomFigure } from "./customFigures";
import { loadDeleted, saveDeleted } from "./tombstones";

export const SYNC_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

let clientPromise: Promise<SupabaseClient> | null = null;
/** The Supabase client, loaded only when sync is configured and used. */
export function client(): Promise<SupabaseClient> {
  if (!SYNC_ENABLED) return Promise.reject(new Error("sync not configured"));
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true, flowType: "pkce" } }),
  );
  return clientPromise;
}

export interface SyncData {
  routines: Routine[];
  customFigures: CustomFigure[];
  deleted: Record<string, number>;
}

/** Merge two lists by id: the newer one wins; deleted ids (newer than the item) are dropped. */
function mergeList<T extends { id: string; updatedAt: number }>(a: T[], b: T[], deleted: Record<string, number>): T[] {
  const byId = new Map<string, T>();
  for (const x of [...a, ...b]) {
    const cur = byId.get(x.id);
    if (!cur || (x.updatedAt ?? 0) > (cur.updatedAt ?? 0)) byId.set(x.id, x);
  }
  // keep the local order, new items from the other side first
  const order = [...b.filter((x) => !a.some((y) => y.id === x.id)), ...a].map((x) => x.id);
  return [...new Set(order)].map((id) => byId.get(id)!).filter((x) => !(deleted[x.id] && deleted[x.id] >= (x.updatedAt ?? 0)));
}

export function merge(local: SyncData, remote: SyncData): SyncData {
  const deleted = { ...remote.deleted };
  for (const [id, t] of Object.entries(local.deleted)) deleted[id] = Math.max(t, deleted[id] ?? 0);
  return {
    routines: mergeList(local.routines, remote.routines, deleted),
    customFigures: mergeList(local.customFigures, remote.customFigures, deleted),
    deleted,
  };
}

/** Pull the user's row, merge with the local data, push the result. Returns the merged data. */
export async function syncNow(local: Omit<SyncData, "deleted">): Promise<SyncData> {
  const sb = await client();
  const { data: auth } = await sb.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) throw new Error("not signed in");
  const { data, error } = await sb.from("user_data").select("routines, custom_figures, deleted").eq("user_id", uid).maybeSingle();
  if (error) throw error;
  const remote: SyncData = {
    routines: Array.isArray(data?.routines) ? data.routines : [],
    customFigures: Array.isArray(data?.custom_figures) ? data.custom_figures : [],
    deleted: data?.deleted && typeof data.deleted === "object" ? data.deleted : {},
  };
  const merged = merge({ ...local, deleted: loadDeleted() }, remote);
  const { error: e2 } = await sb.from("user_data").upsert({
    user_id: uid,
    routines: merged.routines,
    custom_figures: merged.customFigures,
    deleted: merged.deleted,
    updated_at: new Date().toISOString(),
  });
  if (e2) throw e2;
  saveDeleted(merged.deleted);
  return merged;
}

export async function getSession(): Promise<Session | null> {
  const sb = await client();
  return (await sb.auth.getSession()).data.session;
}

export async function onAuthChange(fn: (s: Session | null) => void): Promise<() => void> {
  const sb = await client();
  const { data } = sb.auth.onAuthStateChange((_e, s) => fn(s));
  return () => data.subscription.unsubscribe();
}

/** E-mail with a sign-in link back to this page. */
export async function sendLink(email: string) {
  const sb = await client();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
}

export async function signOut() {
  const sb = await client();
  await sb.auth.signOut();
}
