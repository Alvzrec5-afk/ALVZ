import { loadAccessibleGallery } from "@/lib/gallery-access";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Distance (cosinus, 0 = identique, 1 = sans rapport) maximale pour dire « c'est la même personne », avec les
 * empreintes ArcFace. Banc d'essai du 31 oct. : même personne ≤ 0,54, inconnus ≥ 0,72 ; seuil au milieu, prudent.
 * Essai réel du 31 oct. (galerie ZOEE, visage absent) : photos les plus proches entre 0,78 et 0,83 → aucune photo fausse.
 */
const MAX_DISTANCE = 0.6;

/**
 * Recherche par selfie : le téléphone envoie seulement l'empreinte du visage (512 nombres, ni photo ni
 * enregistrement) ; on renvoie les photos de la galerie où ce visage apparaît, la plus ressemblante d'abord.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await loadAccessibleGallery(slug);
  if ("error" in access) return access.error;
  const { gallery } = access;
  if (!gallery.face_search_enabled) return Response.json({ error: "Recherche par visage désactivée" }, { status: 403 });

  const { descriptor } = (await req.json().catch(() => ({}))) as { descriptor?: number[] };
  if (!Array.isArray(descriptor) || descriptor.length !== 512 || !descriptor.every((n) => Number.isFinite(n) && Math.abs(n) < 10)) {
    return Response.json({ error: "Visage invalide" }, { status: 400 });
  }
  const { data, error } = await createServiceClient().rpc("match_faces_arcface", {
    g: gallery.id,
    q: `[${descriptor.map((n) => Number(n).toFixed(5)).join(",")}]`,
    max_distance: MAX_DISTANCE,
    max_count: 500,
  });
  if (error) return Response.json({ error: "Recherche impossible" }, { status: 500 });
  return Response.json({ photoIds: ((data ?? []) as { photo_id: string }[]).map((r) => r.photo_id) });
}
