import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { abortMultipart, deleteKeys, presignGet, videoKey, videoKeys } from "@/lib/storage";
import type { VideoDownload, VideoRow, VideoView } from "@/lib/types";

export const VIDEO_FIELDS =
  "id, gallery_id, title, filename, original_ext, size_bytes, renditions, duration, width, height, watermarked, downloads_enabled, position, created_at";

type GallerySettings = { watermark: boolean; downloads_enabled: boolean };

const best = (v: VideoRow) => [...v.renditions].sort((a, b) => b.h - a.h)[0];
const label = (h: number) => (h >= 2160 ? "4K" : `${h}p`);

/**
 * Téléchargements proposés : jamais l'original quand le filigrane est demandé
 * (seule une version où il est incrusté peut partir).
 */
export function videoDownloads(v: VideoRow, g: GallerySettings): VideoDownload[] {
  if (!g.downloads_enabled || !v.downloads_enabled) return [];
  const top = best(v);
  if (g.watermark) return v.watermarked && top ? [{ quality: String(top.h), label: label(top.h), bytes: top.bytes }] : [];
  const list: VideoDownload[] = [{ quality: "original", label: "Original", bytes: Number(v.size_bytes) }];
  if (top && top.h < v.height) list.push({ quality: String(top.h), label: `${label(top.h)} (plus léger)`, bytes: top.bytes });
  return list;
}

/** Adresses de lecture, pour le lecteur seulement. */
export async function streamUrls(v: VideoRow) {
  return Object.fromEntries(
    await Promise.all(v.renditions.map(async (r) => [String(r.h), await presignGet(videoKey(v.gallery_id, v.id, `${r.h}.mp4`))] as const)),
  );
}

/**
 * La demande vient-elle d'une page du site, dans un vrai navigateur ?
 * (Les outils de téléchargement qui partent d'un lien n'envoient pas ces en-têtes.)
 */
export function fromOwnPage(req: Request) {
  const host = req.headers.get("host");
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const from = req.headers.get("origin") ?? req.headers.get("referer");
  try {
    return Boolean(from && host && new URL(from).host === host);
  } catch {
    return false;
  }
}

export function downloadKey(v: VideoRow, quality: string) {
  return quality === "original" ? videoKey(v.gallery_id, v.id, `original.${v.original_ext}`) : videoKey(v.gallery_id, v.id, `${quality}.mp4`);
}

export function videoFileName(v: VideoRow, quality: string) {
  const base = v.title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "video";
  return quality === "original" ? `${base}.${v.original_ext}` : `${base} ${label(Number(quality))}.mp4`;
}

/**
 * Page client (`slug`) : les adresses des fichiers ne sont pas écrites dans la page
 * (les sites et logiciels qui « aspirent » un lien ne les trouvent pas) ; le lecteur les demande à part.
 */
export async function toVideoView(v: VideoRow, g: GallerySettings, opts: { slug?: string } = {}): Promise<VideoView> {
  const renditions = [...v.renditions].sort((a, b) => b.h - a.h);
  return {
    id: v.id,
    title: v.title,
    duration: v.duration,
    width: v.width || 16,
    height: v.height || 9,
    poster: await presignGet(videoKey(v.gallery_id, v.id, "poster.jpg")),
    sources: opts.slug
      ? renditions.map((r) => ({ h: r.h, bytes: r.bytes, url: "" }))
      : await Promise.all(renditions.map(async (r) => ({ h: r.h, bytes: r.bytes, url: await presignGet(videoKey(v.gallery_id, v.id, `${r.h}.mp4`)) }))),
    stream: opts.slug ? `/api/g/${opts.slug}/videos/${v.id}/stream` : undefined,
    downloads: videoDownloads(v, g),
    overlayWatermark: g.watermark && !v.watermarked,
    downloadsEnabled: v.downloads_enabled,
    watermarked: v.watermarked,
  };
}

/** Supprime les fichiers Oracle puis les lignes des vidéos indiquées. */
export async function purgeVideos(
  supabase: SupabaseClient,
  rows: { id: string; gallery_id: string; original_ext: string; multipart_upload_id: string | null }[],
) {
  if (rows.length === 0) return;
  await Promise.all(
    rows
      .filter((r) => r.multipart_upload_id)
      .map((r) => abortMultipart(videoKey(r.gallery_id, r.id, `original.${r.original_ext}`), r.multipart_upload_id!)),
  );
  await deleteKeys(rows.flatMap((r) => videoKeys(r.gallery_id, r.id, r.original_ext)));
  const { error } = await supabase.from("videos").delete().in("id", rows.map((r) => r.id));
  if (error) throw new Error(error.message);
}

export const VIDEO_PURGE_FIELDS = "id, gallery_id, original_ext, multipart_upload_id";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Vidéo prête d'une galerie donnée (client « service », après contrôle d'accès à la galerie). */
export async function findPublicVideo(db: SupabaseClient, galleryId: string, videoId: string) {
  if (!UUID.test(videoId)) return null;
  const { data } = await db.from("videos").select(VIDEO_FIELDS).eq("id", videoId).eq("gallery_id", galleryId).eq("status", "ready").maybeSingle();
  return (data as VideoRow | null) ?? null;
}
