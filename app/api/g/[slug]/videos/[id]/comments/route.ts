import { loadAccessibleGallery } from "@/lib/gallery-access";
import { createServiceClient } from "@/lib/supabase/server";
import { findPublicVideo } from "@/lib/videos";

/** Nouveau commentaire sur la timeline (prénom seulement, pas d'e-mail). */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const access = await loadAccessibleGallery(slug);
  if ("error" in access) return access.error;
  const db = createServiceClient();
  const video = await findPublicVideo(db, access.gallery.id, id);
  if (!video) return Response.json({ error: "Vidéo introuvable" }, { status: 404 });

  const input = (await req.json().catch(() => ({}))) as { time?: number; author?: string; body?: string };
  const author = String(input.author ?? "").trim().slice(0, 60);
  const body = String(input.body ?? "").trim().slice(0, 1000);
  if (!author || !body) return Response.json({ error: "Prénom et commentaire obligatoires." }, { status: 400 });
  const time = Math.max(0, Math.min(Number(video.duration) || 0, Number(input.time) || 0));

  // Garde-fou contre les envois en rafale.
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db.from("video_comments").select("id", { count: "exact", head: true }).eq("video_id", video.id).gte("created_at", since);
  if ((count ?? 0) >= 20) return Response.json({ error: "Trop de commentaires d'un coup, réessayez dans une minute." }, { status: 429 });

  const { data, error } = await db
    .from("video_comments")
    .insert({ video_id: video.id, time_sec: time, author, body })
    .select("id, time_sec, author, body, resolved, created_at")
    .single();
  if (error) return Response.json({ error: "Envoi impossible" }, { status: 500 });
  return Response.json(data);
}
