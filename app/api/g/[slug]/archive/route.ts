import { loadAccessibleGallery, logDownload, needsDownloadEmail } from "@/lib/gallery-access";
import { downloadName } from "@/lib/photos";
import { originalKey, presignGet } from "@/lib/storage";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Liste des originaux (URL temporaires) d'une collection ou de toute la galerie.
 * Le fichier ZIP est assemblé directement dans le navigateur du client.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await loadAccessibleGallery(slug);
  if ("error" in access) return access.error;
  const { gallery } = access;
  if (!gallery.downloads_enabled) return Response.json({ error: "Téléchargement désactivé" }, { status: 403 });
  const noEmail = await needsDownloadEmail(gallery);
  if (noEmail) return noEmail;

  const collectionId = new URL(req.url).searchParams.get("collection");
  const db = createServiceClient();
  const { data: collections } = await db.from("collections").select("id, name, position").eq("gallery_id", gallery.id).order("position");
  let query = db
    .from("photos")
    .select("id, gallery_id, collection_id, filename, original_ext, size_bytes, position")
    .eq("gallery_id", gallery.id)
    .eq("status", "ready")
    .order("position");
  if (collectionId) query = query.eq("collection_id", collectionId);
  const { data: photos } = await query;

  const order = new Map((collections ?? []).map((c, i) => [c.id, i]));
  const names = new Map((collections ?? []).map((c) => [c.id, c.name.replace(/[\\/:*?"<>|]/g, "-")]));
  const sorted = (photos ?? []).sort(
    (a, b) => (order.get(a.collection_id) ?? 0) - (order.get(b.collection_id) ?? 0) || a.position - b.position,
  );
  const used = new Set<string>();
  const files = await Promise.all(
    sorted.map(async (p) => {
      const folder = collectionId ? "" : `${names.get(p.collection_id) ?? "Photos"}/`;
      let name = `${folder}${downloadName(p)}`;
      for (let n = 2; used.has(name); n++) name = `${folder}${downloadName(p).replace(/(\.[^.]+)$/, `-${n}$1`)}`;
      used.add(name);
      return { name, size: Number(p.size_bytes), url: await presignGet(originalKey(p.gallery_id, p.id, p.original_ext)) };
    }),
  );
  if (files.length > 0) await logDownload(gallery, { kind: "zip", collectionId: collectionId ?? null, photoCount: files.length });
  const base = `${gallery.title}${collectionId ? ` - ${names.get(collectionId) ?? ""}` : ""}`.replace(/[\\/:*?"<>|]/g, "-");
  return Response.json({ zipName: `${base}.zip`, totalBytes: files.reduce((s, f) => s + f.size, 0), files });
}
