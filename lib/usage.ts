import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Limite de stockage en octets (variable STORAGE_LIMIT_GB, 20 Go par défaut = offre gratuite Oracle). */
export function storageLimitBytes() {
  const gb = Number(process.env.STORAGE_LIMIT_GB);
  return (Number.isFinite(gb) && gb > 0 ? gb : 20) * 1024 ** 3;
}

/** Espace utilisé, au total et par galerie (client admin : soumis aux règles RLS). */
export async function storageUsage(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("storage_usage");
  if (error) throw new Error(`Calcul du stockage impossible : ${error.message}`);
  const perGallery = new Map<string, number>();
  let total = 0;
  for (const row of (data ?? []) as { gallery_id: string; bytes: number }[]) {
    perGallery.set(row.gallery_id, Number(row.bytes));
    total += Number(row.bytes);
  }
  return { total, perGallery, limit: storageLimitBytes() };
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

/** Espace par catégorie, dans l'ordre (fixe) des couleurs de la jauge. */
export function storageParts(o: StudioOverview) {
  return [
    { label: "Galeries photo", bytes: o.bytes_photos },
    { label: "Vidéos", bytes: o.bytes_videos },
    { label: "Tableaux", bytes: o.bytes_boards },
    { label: "Banque d'images", bytes: o.bytes_library },
    { label: "Site", bytes: o.bytes_site },
  ];
}
