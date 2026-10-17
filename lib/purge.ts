import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { abortMultipart, allKeys, deleteKeys, originalKey } from "@/lib/storage";

type Row = { id: string; gallery_id: string; original_ext: string; multipart_upload_id: string | null };

/** Supprime les fichiers Oracle puis les lignes en base pour une liste de photos. */
export async function purgeRows(supabase: SupabaseClient, rows: Row[]) {
  if (rows.length === 0) return;
  await Promise.all(
    rows
      .filter((r) => r.multipart_upload_id)
      .map((r) => abortMultipart(originalKey(r.gallery_id, r.id, r.original_ext), r.multipart_upload_id!)),
  );
  await deleteKeys(rows.flatMap((r) => allKeys(r.gallery_id, r.id, r.original_ext)));
  const { error } = await supabase.from("photos").delete().in("id", rows.map((r) => r.id));
  if (error) throw new Error(error.message);
}

export const PURGE_FIELDS = "id, gallery_id, original_ext, multipart_upload_id";
