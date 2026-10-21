import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { abortMultipart, deleteKeys, listAllObjects, listOpenUploads } from "@/lib/storage";

/**
 * Espace réel chez Oracle, comparé à ce que le studio connaît. Un fichier est « orphelin » quand sa photo, sa vidéo,
 * sa carte de tableau ou sa photo du site n'existe plus dans la base (suppression interrompue, ancien essai…) :
 * Oracle le compte quand même. Les envois en plusieurs morceaux jamais terminés aussi.
 */
export type StorageAuditResult = {
  total: number;
  tracked: number;
  orphans: { count: number; bytes: number };
  uploads: { count: number; bytes: number };
  other: { count: number; bytes: number; examples: string[] };
  /** Ce qui peut être libéré maintenant (orphelins et envois interrompus de plus de 24 h). */
  freeable: { count: number; bytes: number };
};

/** Fichiers récents jamais touchés : un envoi peut être en cours (la carte arrive juste après le fichier). */
const MIN_AGE_MS = 24 * 60 * 60 * 1000;
const UUID = "[0-9a-f-]{36}";

/** Tous les identifiants d'une table (par pages : Supabase en rend 1000 au plus par appel). */
async function allIds(db: SupabaseClient, table: string, column = "id") {
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(column).range(from, from + 999);
    if (error) throw new Error(`Lecture de ${table} impossible : ${error.message}`);
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) if (row[column]) ids.add(String(row[column]));
    if (!data || data.length < 1000) return ids;
  }
}

async function scan(db: SupabaseClient) {
  const [objects, uploads, photos, videos, items, covers, siteItems] = await Promise.all([
    listAllObjects(),
    listOpenUploads(),
    allIds(db, "photos"),
    allIds(db, "videos"),
    allIds(db, "board_items"),
    allIds(db, "boards", "cover_key"),
    allIds(db, "site_items"),
  ]);

  /** true = connu, false = orphelin, null = rangement inconnu (laissé tel quel). */
  const known = (key: string): boolean | null => {
    let m = key.match(new RegExp(`^galleries/${UUID}/videos/(${UUID})/`));
    if (m) return videos.has(m[1]);
    m = key.match(new RegExp(`^galleries/${UUID}/(${UUID})/`));
    if (m) return photos.has(m[1]);
    if (new RegExp(`^boards/${UUID}/cover-[0-9a-f]+\\.jpg$`).test(key)) return covers.has(key);
    m = key.match(new RegExp(`^boards/${UUID}/(${UUID})\\.jpg$`));
    if (m) return items.has(m[1]);
    m = key.match(new RegExp(`^site/items/(${UUID})(-thumb)?\\.jpg$`));
    if (m) return siteItems.has(m[1]);
    return null;
  };

  const now = Date.now();
  const res: StorageAuditResult = {
    total: 0,
    tracked: 0,
    orphans: { count: 0, bytes: 0 },
    uploads: { count: uploads.length, bytes: 0 },
    other: { count: 0, bytes: 0, examples: [] },
    freeable: { count: 0, bytes: 0 },
  };
  const orphanKeys: string[] = [];
  for (const o of objects) {
    res.total += o.size;
    const k = known(o.key);
    if (k === true) res.tracked += o.size;
    else if (k === false) {
      res.orphans.count++;
      res.orphans.bytes += o.size;
      if (now - o.modified > MIN_AGE_MS) {
        orphanKeys.push(o.key);
        res.freeable.count++;
        res.freeable.bytes += o.size;
      }
    } else {
      res.other.count++;
      res.other.bytes += o.size;
      if (res.other.examples.length < 5) res.other.examples.push(o.key);
    }
  }
  const oldUploads = uploads.filter((u) => now - u.started > MIN_AGE_MS);
  for (const u of uploads) {
    res.total += u.size;
    res.uploads.bytes += u.size;
  }
  for (const u of oldUploads) {
    res.freeable.count++;
    res.freeable.bytes += u.size;
  }
  return { res, orphanKeys, oldUploads, objectCount: objects.length };
}

export async function auditStorage(db: SupabaseClient) {
  return (await scan(db)).res;
}

/**
 * Libère l'espace : supprime les fichiers orphelins et annule les envois interrompus (plus de 24 h).
 * Garde-fou : si plus de la moitié des fichiers semblent orphelins, on ne touche à rien (base mal reliée ?).
 */
export async function cleanStorage(db: SupabaseClient) {
  const { res, orphanKeys, oldUploads, objectCount } = await scan(db);
  if (objectCount > 20 && orphanKeys.length > objectCount / 2) {
    throw new Error("Trop de fichiers semblent orphelins : par sécurité, rien n'a été supprimé.");
  }
  await deleteKeys(orphanKeys);
  for (const u of oldUploads) await abortMultipart(u.key, u.uploadId);
  return { freed: res.freeable.bytes, files: orphanKeys.length, uploads: oldUploads.length };
}
