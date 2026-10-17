import { loadAccessibleGallery } from "@/lib/gallery-access";
import { downloadName } from "@/lib/photos";
import { originalKey, presignGet } from "@/lib/storage";
import { createServiceClient } from "@/lib/supabase/server";

/** Téléchargement d'une photo en HD : redirige vers une URL Oracle temporaire. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await loadAccessibleGallery(slug);
  if ("error" in access) return access.error;
  const { gallery } = access;
  if (!gallery.downloads_enabled) return Response.json({ error: "Téléchargement désactivé" }, { status: 403 });

  const photoId = new URL(req.url).searchParams.get("photo");
  if (!photoId) return Response.json({ error: "Photo manquante" }, { status: 400 });
  const { data: photo } = await createServiceClient()
    .from("photos")
    .select("id, gallery_id, filename, original_ext")
    .eq("id", photoId)
    .eq("gallery_id", gallery.id)
    .eq("status", "ready")
    .maybeSingle();
  if (!photo) return Response.json({ error: "Photo introuvable" }, { status: 404 });

  const url = await presignGet(originalKey(photo.gallery_id, photo.id, photo.original_ext), {
    downloadName: downloadName(photo),
  });
  return Response.redirect(url, 302);
}
