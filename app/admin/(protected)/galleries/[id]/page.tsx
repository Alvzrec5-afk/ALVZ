import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { toParisDateInput } from "@/lib/dates";
import { DESIGN_FIELDS, type GalleryDesign } from "@/lib/design";
import { PHOTO_FIELDS, toPhotoViews } from "@/lib/photos";
import type { Collection, PhotoRow } from "@/lib/types";
import { GalleryManager, type ManagedGallery } from "@/components/admin/gallery-manager";

export const metadata = { title: "Galerie" };
export const dynamic = "force-dynamic";

export default async function GalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdminPage();

  const { data: g } = await supabase
    .from("galleries")
    .select(
      `id, slug, title, event_date, cover_photo_id, password_hash, expires_at, watermark, downloads_enabled, download_web_enabled, favorites_enabled, ${DESIGN_FIELDS}`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!g) notFound();

  const [{ data: collections }, { data: photos }, { data: lists }] = await Promise.all([
    supabase.from("collections").select("id, name, position").eq("gallery_id", id).order("position"),
    supabase.from("photos").select(PHOTO_FIELDS).eq("gallery_id", id).eq("status", "ready").order("position"),
    supabase
      .from("favorite_lists")
      .select("id, email, created_at, favorites(photo_id)")
      .eq("gallery_id", id)
      .order("created_at"),
  ]);

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
    design: {
      cover_layout: g.cover_layout,
      cover_focus_x: g.cover_focus_x,
      cover_focus_y: g.cover_focus_y,
      font_style: g.font_style,
      color_theme: g.color_theme,
      grid_style: g.grid_style,
      grid_size: g.grid_size,
      grid_spacing: g.grid_spacing,
    } as GalleryDesign,
  };

  return (
    <GalleryManager
      gallery={gallery}
      collections={(collections ?? []) as Collection[]}
      photos={views}
      positions={positions}
      favoriteLists={(lists ?? []).map((l) => ({
        id: l.id,
        email: l.email,
        photoIds: (l.favorites as { photo_id: string }[]).map((f) => f.photo_id),
      }))}
    />
  );
}
