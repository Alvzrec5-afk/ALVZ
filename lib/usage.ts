import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateTag, unstable_cache } from "next/cache";
import { listAllObjects, listOpenUploads } from "@/lib/storage";

/**
 * Limite de stockage en octets (variable STORAGE_LIMIT_GB). 20 Go par défaut : un compte Oracle « Toujours gratuit » a droit
 * à 20 Go au total (Object Storage + Archive) ; au-delà, à la fin de l'essai gratuit, Oracle supprime les données.
 * Les envois sont refusés à la limite (calculée sur l'espace réel du bucket), elle ne peut donc pas être dépassée.
 */
export function storageLimitBytes() {
  const gb = Number(process.env.STORAGE_LIMIT_GB);
  return (Number.isFinite(gb) && gb > 0 ? gb : 20) * 1024 ** 3;
}

const ORACLE_TAG = "oracle-usage";

/**
 * Espace réellement facturé par Oracle (tous les fichiers du bucket + envois interrompus), relu au plus une fois par
 * heure (cache partagé entre les démarrages). Il peut dépasser ce que la base connaît : fichiers oubliés.
 */
const oracleTotal = unstable_cache(
  async () => {
    const [objects, uploads] = await Promise.all([listAllObjects(), listOpenUploads()]);
    return objects.reduce((n, o) => n + o.size, 0) + uploads.reduce((n, u) => n + u.size, 0);
  },
  ["oracle-total"],
  { revalidate: 3600, tags: [ORACLE_TAG] },
);

/** Après un nettoyage : le prochain affichage relit l'espace réel chez Oracle. */
export function refreshOracleTotal() {
  revalidateTag(ORACLE_TAG, { expire: 0 });
}

/**
 * Espace utilisé, au total et par galerie (client admin : soumis aux règles RLS). Le total est le plus grand des deux :
 * ce que la base connaît, ou ce qu'Oracle compte réellement (`untracked` = la différence, fichiers oubliés).
 */
export async function storageUsage(supabase: SupabaseClient) {
  const [{ data, error }, real] = await Promise.all([supabase.rpc("storage_usage"), oracleTotal().catch(() => 0)]);
  if (error) throw new Error(`Calcul du stockage impossible : ${error.message}`);
  const perGallery = new Map<string, number>();
  let known = 0;
  for (const row of (data ?? []) as { gallery_id: string; bytes: number }[]) {
    perGallery.set(row.gallery_id, Number(row.bytes));
    known += Number(row.bytes);
  }
  return { total: Math.max(known, real), untracked: Math.max(0, real - known), perGallery, limit: storageLimitBytes() };
}

export type StudioOverview = {
  photo_galleries: number;
  video_projects: number;
  photos: number;
  videos: number;
  boards: number;
  library_images: number;
  downloads_30d: number;
  video_views_30d: number;
  favorites: number;
  site_items: number;
  site_messages_unread: number;
  bytes_photos: number;
  bytes_videos: number;
  bytes_boards: number;
  bytes_library: number;
  bytes_site: number;
};

/** Chiffres de l'accueil du studio, en une requête (fonction SQL `studio_overview`). */
export async function studioOverview(supabase: SupabaseClient): Promise<StudioOverview> {
  const { data, error } = await supabase.rpc("studio_overview");
  if (error) throw new Error(`Chiffres du studio indisponibles : ${error.message}`);
  const o = (data ?? {}) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number(v) || 0])) as StudioOverview;
}

/** Espace par catégorie, dans l'ordre (fixe) des couleurs de la jauge ; en dernier, les fichiers oubliés chez Oracle. */
export function storageParts(o: StudioOverview, untracked = 0) {
  return [
    { label: "Galeries photo", bytes: o.bytes_photos },
    { label: "Vidéos", bytes: o.bytes_videos },
    { label: "Tableaux", bytes: o.bytes_boards },
    { label: "Banque d'images", bytes: o.bytes_library },
    { label: "Site", bytes: o.bytes_site },
    ...(untracked > 0 ? [{ label: "Fichiers oubliés", bytes: untracked }] : []),
  ];
}
