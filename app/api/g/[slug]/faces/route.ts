import { isStudioSession } from "@/lib/auth";
import { loadAccessibleGallery } from "@/lib/gallery-access";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Distance maximale entre deux empreintes pour dire « c'est la même personne ». 0,6 (valeur par défaut de face-api)
 * donnait des inconnus sur une vraie galerie (31 oct. : 26 photos pour une personne absente) ; des visages inconnus
 * testés sur cette galerie restaient au-dessus de 0,54, la bonne personne entre 0,38 et 0,54 (selfies de mauvaise qualité).
 * À affiner avec les distances affichées au studio (mode réglage).
 */
const MAX_DISTANCE = 0.5;

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
  // Studio connecté (mode réglage) : on cherche plus large pour montrer aussi les distances juste au-dessus du seuil.
  const studio = await isStudioSession();
  const { data, error } = await createServiceClient().rpc("match_faces", {
    g: gallery.id,
    q: `[${descriptor.map((n) => Number(n).toFixed(5)).join(",")}]`,
    max_distance: studio ? 0.75 : MAX_DISTANCE,
    max_count: 500,
  });
  if (error) return Response.json({ error: "Recherche impossible" }, { status: 500 });
  const rows = (data ?? []) as { photo_id: string; distance: number }[];
  return Response.json({
    photoIds: rows.filter((r) => r.distance < MAX_DISTANCE).map((r) => r.photo_id),
    // Jamais pour les clients : les 15 photos les plus proches, avec leur distance.
    ...(studio ? { distances: rows.slice(0, 15).map((r) => Math.round(r.distance * 1000) / 1000), threshold: MAX_DISTANCE } : {}),
  });
}
