import { loadAccessibleGallery } from "@/lib/gallery-access";
import { createServiceClient } from "@/lib/supabase/server";

/** Distance maximale entre deux empreintes pour dire « c'est la même personne » (valeur standard de face-api ; inconnus ≈ 0,7 et plus). */
const MAX_DISTANCE = 0.6;

/**
 * Recherche par selfie : le téléphone envoie seulement l'empreinte du visage (128 nombres, ni photo ni
 * enregistrement) ; on renvoie les photos de la galerie où ce visage apparaît, la plus ressemblante d'abord.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await loadAccessibleGallery(slug);
  if ("error" in access) return access.error;
  const { gallery } = access;
  if (!gallery.face_search_enabled) return Response.json({ error: "Recherche par visage désactivée" }, { status: 403 });

  const { descriptor } = (await req.json().catch(() => ({}))) as { descriptor?: number[] };
  if (!Array.isArray(descriptor) || descriptor.length !== 128 || !descriptor.every((n) => Number.isFinite(n) && Math.abs(n) < 10)) {
    return Response.json({ error: "Visage invalide" }, { status: 400 });
  }
  const { data, error } = await createServiceClient().rpc("match_faces", {
    g: gallery.id,
    q: `[${descriptor.map((n) => Number(n).toFixed(5)).join(",")}]`,
    max_distance: MAX_DISTANCE,
    max_count: 500,
  });
  if (error) return Response.json({ error: "Recherche impossible" }, { status: 500 });
  return Response.json({ photoIds: ((data ?? []) as { photo_id: string }[]).map((r) => r.photo_id) });
}
