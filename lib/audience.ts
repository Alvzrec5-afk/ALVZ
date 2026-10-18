import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sign, unsign } from "@/lib/tokens";

export type AudienceMember = {
  email: string;
  galleries: string[];
  lastSeen: string;
  favorites: boolean;
  downloads: number;
  unsubscribed: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Toutes les adresses laissées par les clients (favoris, téléchargements), de la plus récente à la plus ancienne. */
export async function loadAudience(supabase: SupabaseClient): Promise<AudienceMember[]> {
  const [lists, downloads, videoDownloads, unsubs] = await Promise.all([
    supabase.from("favorite_lists").select("email, created_at, galleries(title)"),
    supabase.from("downloads").select("email, created_at, galleries(title)").not("email", "is", null).limit(10000),
    supabase.from("video_events").select("email, created_at, videos(galleries(title))").eq("kind", "download").not("email", "is", null).limit(10000),
    supabase.from("mail_unsubscribes").select("email"),
  ]);
  if (lists.error) throw new Error(lists.error.message);
  if (downloads.error) throw new Error(downloads.error.message);
  const blocked = new Set((unsubs.data ?? []).map((u) => u.email as string));

  const byEmail = new Map<string, AudienceMember & { titles: Set<string> }>();
  const add = (row: { email: unknown; created_at: unknown; galleries: unknown }, kind: "fav" | "dl") => {
    const email = String(row.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return;
    const title = (row.galleries as { title?: string } | null)?.title;
    const at = String(row.created_at);
    let m = byEmail.get(email);
    if (!m) {
      m = { email, galleries: [], titles: new Set(), lastSeen: at, favorites: false, downloads: 0, unsubscribed: blocked.has(email) };
      byEmail.set(email, m);
    }
    if (title) m.titles.add(title);
    if (at > m.lastSeen) m.lastSeen = at;
    if (kind === "fav") m.favorites = true;
    else m.downloads++;
  };
  (lists.data ?? []).forEach((r) => add(r, "fav"));
  (downloads.data ?? []).forEach((r) => add(r, "dl"));
  (videoDownloads.data ?? []).forEach((r) =>
    add({ email: r.email, created_at: r.created_at, galleries: (r.videos as { galleries?: unknown } | null)?.galleries ?? null }, "dl"),
  );

  return [...byEmail.values()]
    .map(({ titles, ...m }) => ({ ...m, galleries: [...titles] }))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

/** Jeton de désinscription signé (impossible à fabriquer pour une autre adresse). */
export function unsubscribeToken(email: string) {
  return sign(`u:${Buffer.from(email).toString("base64url")}`);
}

export function readUnsubscribeToken(token: string | undefined) {
  const value = unsign(token);
  if (!value?.startsWith("u:")) return null;
  const email = Buffer.from(value.slice(2), "base64url").toString();
  return EMAIL_RE.test(email) ? email : null;
}
