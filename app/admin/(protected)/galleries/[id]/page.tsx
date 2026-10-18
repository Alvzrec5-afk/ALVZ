import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { toParisDateInput } from "@/lib/dates";
import { DESIGN_FIELDS, readDesign } from "@/lib/design";
import { PHOTO_FIELDS, toPhotoViews } from "@/lib/photos";
import type { Collection, PhotoRow, VideoComment, VideoRow } from "@/lib/types";
import { VIDEO_FIELDS, toVideoView } from "@/lib/videos";
import type { AdminVideo } from "@/components/admin/videos-panel";
import { GalleryManager, type ManagedGallery } from "@/components/admin/gallery-manager";
import type { DownloadRow } from "@/components/admin/downloads-panel";

export const metadata = { title: "Galerie" };
export const dynamic = "force-dynamic";

export default async function GalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdminPage();

  // Toutes les requêtes partent en même temps (une seule attente au lieu de deux).
  const [{ data: g }, { data: collections }, { data: photos }, { data: lists }, { data: downloads }, { data: videoRows }] = await Promise.all([
    supabase
      .from("galleries")
      .select(
        `id, slug, title, event_date, cover_photo_id, password_hash, expires_at, watermark, downloads_enabled, download_web_enabled, favorites_enabled, ${DESIGN_FIELDS}`,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("collections").select("id, name, position").eq("gallery_id", id).order("position"),
    supabase.from("photos").select(PHOTO_FIELDS).eq("gallery_id", id).eq("status", "ready").order("position"),
    supabase
      .from("favorite_lists")
      .select("id, email, created_at, favorites(photo_id)")
      .eq("gallery_id", id)
      .order("created_at"),
    supabase
      .from("downloads")
      .select("id, photo_id, collection_id, kind, size, photo_count, email, created_at")
      .eq("gallery_id", id)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("videos")
      .select(`${VIDEO_FIELDS}, video_comments(id, time_sec, author, body, resolved, created_at), video_events(kind, watched_pct)`)
      .eq("gallery_id", id)
      .eq("status", "ready")
      .order("position"),
  ]);
  if (!g) notFound();

  type VideoWithActivity = VideoRow & { video_comments: VideoComment[]; video_events: { kind: string; watched_pct: number }[] };
  const videos: AdminVideo[] = await Promise.all(
    ((videoRows ?? []) as VideoWithActivity[]).map(async (v) => {
      const plays = v.video_events.filter((e) => e.kind === "view");
      return {
        ...(await toVideoView(v, { watermark: g.watermark, downloads_enabled: true })),
        sizeBytes: Number(v.size_bytes),
        createdAt: v.created_at,
        comments: v.video_comments,
        views: plays.length,
        avgWatched: plays.length ? Math.round(plays.reduce((s, e) => s + e.watched_pct, 0) / plays.length) : 0,
        downloadCount: v.video_events.filter((e) => e.kind === "download").length,
      };
    }),
  );

  const views = await toPhotoViews((photos ?? []) as PhotoRow[], false);
  const positions = Object.fromEntries((photos ?? []).map((p) => [p.id, p.position as number]));
  const expired = Boolean(g.expires_at && new Date(g.expires_at) < new Date());

  const gallery: ManagedGallery = {
    id: g.id,
    slug: g.slug,
    title: g.title,
    eventDate: g.event_date ?? "",
    expiresAt: toParisDateInput(g.expires_at),
    expired,
    coverPhotoId: g.cover_photo_id,
    hasPassword: Boolean(g.password_hash),
    watermark: g.watermark,
    downloadsEnabled: g.downloads_enabled,
    downloadWebEnabled: g.download_web_enabled,
    favoritesEnabled: g.favorites_enabled,
    design: readDesign(g),
  };

  return (
    <GalleryManager
      gallery={gallery}
      collections={(collections ?? []) as Collection[]}
      photos={views}
      positions={positions}
      videos={videos}
      downloads={(downloads ?? []) as DownloadRow[]}
      favoriteLists={(lists ?? []).map((l) => ({
        id: l.id,
        email: l.email,
        photoIds: (l.favorites as { photo_id: string }[]).map((f) => f.photo_id),
      }))}
    />
  );
}
