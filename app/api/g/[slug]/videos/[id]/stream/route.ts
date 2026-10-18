import { loadAccessibleGallery } from "@/lib/gallery-access";
import { createServiceClient } from "@/lib/supabase/server";
import { findPublicVideo, fromOwnPage, streamUrls } from "@/lib/videos";

/** Adresses de lecture d'une vidéo, demandées par le lecteur de la page (jamais écrites dans la page). */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!fromOwnPage(req) || req.headers.get("x-alvz-player") !== "1") {
    return Response.json({ error: "Lecture non autorisée" }, { status: 403 });
  }
  const access = await loadAccessibleGallery(slug);
  if ("error" in access) return access.error;
  const video = await findPublicVideo(createServiceClient(), access.gallery.id, id);
  if (!video) return Response.json({ error: "Vidéo introuvable" }, { status: 404 });
  return Response.json({ urls: await streamUrls(video) }, { headers: { "Cache-Control": "no-store" } });
}
