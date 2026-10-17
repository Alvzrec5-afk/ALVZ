import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { toParisDateInput } from "@/lib/dates";
import { PHOTO_FIELDS, toPhotoViews } from "@/lib/photos";
import type { Collection, PhotoRow } from "@/lib/types";
import { GalleryManager } from "@/components/admin/gallery-manager";

export const metadata = { title: "Galerie" };

export default async function GalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdminPage();

  const { data: gallery } = await supabase
    .from("galleries")
    .select("id, slug, title, event_date, cover_photo_id, password_hash, expires_at, watermark, downloads_enabled, theme")
    .eq("id", id)
    .maybeSingle();
  if (!gallery) notFound();

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

  return (
    <GalleryManager
      gallery={{
        id: gallery.id,
        slug: gallery.slug,
        title: gallery.title,
        coverPhotoId: gallery.cover_photo_id,
        form: {
          title: gallery.title,
          event_date: gallery.event_date ?? "",
          expires_at: toParisDateInput(gallery.expires_at),
          watermark: gallery.watermark,
          downloads_enabled: gallery.downloads_enabled,
          theme: gallery.theme,
          hasPassword: Boolean(gallery.password_hash),
        },
      }}
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
