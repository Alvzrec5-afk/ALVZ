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
