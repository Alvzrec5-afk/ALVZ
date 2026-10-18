import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatLongDate } from "@/lib/dates";
import { themeAttr } from "@/lib/design";
import { findGalleryBySlug, getFavoriteListId, hasAccess, isExpired } from "@/lib/gallery-access";
import { PHOTO_FIELDS, toPhotoViews } from "@/lib/photos";
import { createServiceClient } from "@/lib/supabase/server";
import type { Collection, PhotoRow } from "@/lib/types";
import { ClientGallery } from "@/components/gallery/client-gallery";
import { ExpiredScreen, LockScreen } from "@/components/gallery/screens";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = await findGalleryBySlug((await params).slug);
  return { title: g ? g.title : "Galerie", robots: { index: false, follow: false } };
}

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gallery = await findGalleryBySlug(slug);
  if (!gallery) notFound();
  if (isExpired(gallery)) return <ExpiredScreen theme={themeAttr(gallery)} />;
  if (!(await hasAccess(gallery))) return <LockScreen slug={slug} title={gallery.title} theme={themeAttr(gallery)} fontStyle={gallery.font_style} />;

  const db = createServiceClient();
  const listId = await getFavoriteListId(gallery);
  const [{ data: collections }, { data: photos }, list] = await Promise.all([
    db.from("collections").select("id, name, position").eq("gallery_id", gallery.id).order("position"),
    db.from("photos").select(PHOTO_FIELDS).eq("gallery_id", gallery.id).eq("status", "ready").order("position"),
    listId
      ? db.from("favorite_lists").select("email, favorites(photo_id)").eq("id", listId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const views = await toPhotoViews((photos ?? []) as PhotoRow[], gallery.watermark);
  const visibleCollections = ((collections ?? []) as Collection[]).filter((c) => views.some((p) => p.collectionId === c.id));
  const cover = views.find((p) => p.id === gallery.cover_photo_id) ?? views[0] ?? null;
  const favData = list.data as { email: string; favorites: { photo_id: string }[] } | null;

  return (
    <ClientGallery
      slug={slug}
      title={gallery.title}
      date={formatLongDate(gallery.event_date)}
      design={{
        cover_layout: gallery.cover_layout,
        cover_focus_x: gallery.cover_focus_x,
        cover_focus_y: gallery.cover_focus_y,
        font_style: gallery.font_style,
        color_theme: gallery.color_theme,
        color_follow_device: gallery.color_follow_device,
        grid_style: gallery.grid_style,
        grid_size: gallery.grid_size,
        grid_spacing: gallery.grid_spacing,
      }}
      watermark={gallery.watermark}
      downloadsEnabled={gallery.downloads_enabled}
      downloadWebEnabled={gallery.download_web_enabled}
      favoritesEnabled={gallery.favorites_enabled}
      cover={cover ? { src: cover.web, width: cover.width, height: cover.height } : null}
      collections={visibleCollections}
      photos={views}
      favorites={{ email: favData?.email ?? null, photoIds: favData?.favorites.map((f) => f.photo_id) ?? [] }}
    />
  );
}
