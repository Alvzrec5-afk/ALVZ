import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readDesign, themeAttr } from "@/lib/design";
import { findGalleryBySlug, hasAccess, isExpired } from "@/lib/gallery-access";
import { createServiceClient } from "@/lib/supabase/server";
import type { VideoComment, VideoRow } from "@/lib/types";
import { VIDEO_FIELDS, findPublicVideo, toVideoView } from "@/lib/videos";
import { presignGet, videoKey } from "@/lib/storage";
import { VideoPage } from "@/components/gallery/video-page";
import { ExpiredScreen, LockScreen } from "@/components/gallery/screens";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = await findGalleryBySlug((await params).slug);
  return { title: g ? g.title : "Vidéo", robots: { index: false, follow: false } };
}

/** Lien direct vers une vidéo : le client arrive sur le lecteur, prêt à lire. */
export default async function VideoRoute({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const gallery = await findGalleryBySlug(slug);
  if (!gallery) notFound();
  const design = readDesign(gallery);
  if (isExpired(gallery)) return <ExpiredScreen theme={themeAttr(design)} />;
  if (!(await hasAccess(gallery))) {
    return <LockScreen slug={slug} title={gallery.title} theme={themeAttr(design)} fontStyle={design.font_style} next={`/g/${slug}/v/${id}`} />;
  }

  const db = createServiceClient();
  const video = await findPublicVideo(db, gallery.id, id);
  if (!video) notFound();
  const [view, { data: comments }, { data: others }] = await Promise.all([
    toVideoView(video, gallery, { slug }),
    db.from("video_comments").select("id, time_sec, author, body, resolved, created_at").eq("video_id", video.id).order("time_sec"),
    db.from("videos").select(VIDEO_FIELDS).eq("gallery_id", gallery.id).eq("status", "ready").neq("id", video.id).order("position"),
  ]);
  const more = await Promise.all(
    ((others ?? []) as VideoRow[]).map(async (v) => ({
      id: v.id,
      title: v.title,
      duration: v.duration,
      poster: await presignGet(videoKey(v.gallery_id, v.id, "poster.jpg")),
    })),
  );

  return (
    <VideoPage
      slug={slug}
      galleryTitle={gallery.title}
      design={design}
      video={view}
      comments={(comments ?? []) as VideoComment[]}
      others={more}
      backHref={gallery.kind === "video" && more.length === 0 ? null : `/g/${slug}`}
    />
  );
}
