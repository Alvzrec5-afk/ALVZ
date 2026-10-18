import { loadAccessibleGallery } from "@/lib/gallery-access";
import { createServiceClient } from "@/lib/supabase/server";
import { sign, unsign } from "@/lib/tokens";
import { findPublicVideo } from "@/lib/videos";

/**
 * Activité anonyme : { start: true, quality } à la première lecture (renvoie un jeton),
 * puis { token, pct } pour la part regardée (envoyé aussi en quittant la page).
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const access = await loadAccessibleGallery(slug);
  if ("error" in access) return access.error;
  const db = createServiceClient();
  const input = (await req.json().catch(() => ({}))) as { start?: boolean; quality?: number; token?: string; pct?: number };

  if (input.token) {
    const eventId = unsign(input.token);
    if (!eventId) return Response.json({ error: "Jeton invalide" }, { status: 400 });
    const pct = Math.max(0, Math.min(100, Math.round(Number(input.pct) || 0)));
    await db.from("video_events").update({ watched_pct: pct }).eq("id", eventId).lt("watched_pct", pct);
    return Response.json({ ok: true });
  }

  const video = await findPublicVideo(db, access.gallery.id, id);
  if (!video) return Response.json({ error: "Vidéo introuvable" }, { status: 404 });
  const quality = Number.isFinite(Number(input.quality)) ? `${Math.round(Number(input.quality))}p` : null;
  const { data } = await db.from("video_events").insert({ video_id: video.id, kind: "view", quality }).select("id").single();
  return Response.json({ token: data ? sign(data.id) : null });
}
