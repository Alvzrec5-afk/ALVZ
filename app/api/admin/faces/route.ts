import { apiError, requireAdminApi } from "@/lib/auth";
import { isUuid } from "@/lib/boards";
import { originalKey, presignGet, variantKey } from "@/lib/storage";

const DIM = 128;

/**
 * Recherche par visage — état d'une galerie : activée ou non, photos analysées / total.
 * Sans `count=1` : aussi les photos à analyser (200 au plus par appel), avec l'adresse de l'original
 * et de la version web (si le navigateur ne sait pas lire l'original).
 */
export async function GET(req: Request) {
  try {
    const { supabase } = await requireAdminApi();
    const url = new URL(req.url);
    const galleryId = url.searchParams.get("gallery") ?? "";
    if (!isUuid(galleryId)) return Response.json({ error: "Galerie invalide" }, { status: 400 });
    const [{ data: g }, total, done] = await Promise.all([
      supabase.from("galleries").select("face_search_enabled").eq("id", galleryId).maybeSingle(),
      supabase.from("photos").select("id", { count: "exact", head: true }).eq("gallery_id", galleryId).eq("status", "ready"),
      supabase.from("photos").select("id", { count: "exact", head: true }).eq("gallery_id", galleryId).eq("status", "ready").not("faces_indexed_at", "is", null),
    ]);
    if (!g) return Response.json({ error: "Galerie introuvable" }, { status: 404 });
    const body = { enabled: Boolean(g.face_search_enabled), total: total.count ?? 0, done: done.count ?? 0 };
    if (url.searchParams.get("count")) return Response.json(body);

    const { data: rows } = await supabase
      .from("photos")
      .select("id, gallery_id, original_ext")
      .eq("gallery_id", galleryId)
      .eq("status", "ready")
      .is("faces_indexed_at", null)
      .order("position")
      .limit(200);
    const pending = await Promise.all(
      (rows ?? []).map(async (p) => ({
        id: p.id as string,
        urls: await Promise.all([presignGet(originalKey(p.gallery_id, p.id, p.original_ext)), presignGet(variantKey(p.gallery_id, p.id, "web"))]),
      })),
    );
    return Response.json({ ...body, pending });
  } catch (e) {
    return apiError(e);
  }
}

/** Enregistre les visages d'une photo (remplace l'analyse précédente). */
export async function POST(req: Request) {
  try {
    const { supabase } = await requireAdminApi();
    const { photoId, faces } = (await req.json()) as { photoId?: string; faces?: { box?: Record<string, number>; descriptor?: number[] }[] };
    if (!isUuid(photoId) || !Array.isArray(faces) || faces.length > 300) return Response.json({ error: "Requête invalide" }, { status: 400 });
    const { data: photo } = await supabase.from("photos").select("id, gallery_id").eq("id", photoId).maybeSingle();
    if (!photo) return Response.json({ error: "Photo introuvable" }, { status: 404 });

    const unit = (n: unknown) => Math.min(1, Math.max(0, Number(n) || 0));
    const rows = faces
      .filter((f) => Array.isArray(f.descriptor) && f.descriptor.length === DIM && f.descriptor.every((n) => Number.isFinite(n)))
      .map((f) => ({
        photo_id: photo.id,
        gallery_id: photo.gallery_id,
        box: { x: unit(f.box?.x), y: unit(f.box?.y), w: unit(f.box?.w), h: unit(f.box?.h) },
        descriptor: `[${f.descriptor!.map((n) => Number(n).toFixed(5)).join(",")}]`,
      }));
    const { error: delError } = await supabase.from("photo_faces").delete().eq("photo_id", photo.id);
    if (delError) throw new Error(delError.message);
    if (rows.length) {
      const { error } = await supabase.from("photo_faces").insert(rows);
      if (error) throw new Error(error.message);
    }
    const { error } = await supabase.from("photos").update({ faces_indexed_at: new Date().toISOString() }).eq("id", photo.id);
    if (error) throw new Error(error.message);
    return Response.json({ faces: rows.length });
  } catch (e) {
    return apiError(e);
  }
}
