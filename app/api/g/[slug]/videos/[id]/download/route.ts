import { loadAccessibleGallery, needsDownloadEmail, visitorEmail } from "@/lib/gallery-access";
import { presignGet } from "@/lib/storage";
import { createServiceClient } from "@/lib/supabase/server";
import { downloadKey, findPublicVideo, fromOwnPage, videoDownloads, videoFileName } from "@/lib/videos";

/** Téléchargement d'une vidéo (si autorisé) : redirige vers une URL Oracle temporaire. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  // Seulement depuis le bouton de la page vidéo, jamais depuis un autre site ou logiciel.
  if (!fromOwnPage(req)) return Response.json({ error: "Téléchargement non autorisé" }, { status: 403 });
  const access = await loadAccessibleGallery(slug);
  if ("error" in access) return access.error;
  const { gallery } = access;
  const db = createServiceClient();
  const video = await findPublicVideo(db, gallery.id, id);
  if (!video) return Response.json({ error: "Vidéo introuvable" }, { status: 404 });

  const quality = new URL(req.url).searchParams.get("q") ?? "";
  const allowed = videoDownloads(video, gallery).find((d) => d.quality === quality);
  if (!allowed) return Response.json({ error: "Téléchargement non autorisé" }, { status: 403 });
  const noEmail = await needsDownloadEmail(gallery);
  if (noEmail) return noEmail;

  try {
    await db.from("video_events").insert({ video_id: video.id, kind: "download", quality: allowed.label, email: await visitorEmail(gallery) });
  } catch {}
  return Response.redirect(await presignGet(downloadKey(video, quality), { downloadName: videoFileName(video, quality) }), 302);
}
