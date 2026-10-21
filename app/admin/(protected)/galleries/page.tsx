import { requireAdminPage } from "@/lib/auth";
import { formatLongDate } from "@/lib/dates";
import { presignGet, variantKey } from "@/lib/storage";
import { StorageCheck } from "@/components/admin/storage-check";
import { GalleryGrid, type GalleryCard } from "@/components/admin/gallery-grid";
import { StorageAlert, StorageMeter } from "@/components/admin/storage-meter";
import { storageParts, storageUsage, studioOverview } from "@/lib/usage";

export const metadata = { title: "Galeries" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  slug: string;
  title: string;
  event_date: string | null;
  cover_photo_id: string | null;
  password_hash: string | null;
  expires_at: string | null;
  created_at: string;
  photos: { count: number }[];
};

export default async function GalleriesHome() {
  const { supabase } = await requireAdminPage();
  const [{ data, error }, usage, overview] = await Promise.all([
    supabase
      .from("galleries")
      .select("id, slug, title, event_date, cover_photo_id, password_hash, expires_at, created_at, photos!photos_gallery_id_fkey(count)")
      .eq("kind", "photo")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    storageUsage(supabase),
    studioOverview(supabase),
  ]);
  if (error) throw new Error(`Impossible de charger les galeries : ${error.message}`);
  const rows = (data ?? []) as Row[];

  const galleries: GalleryCard[] = await Promise.all(
    rows.map(async (g) => ({
      id: g.id,
      slug: g.slug,
      title: g.title,
      date: formatLongDate(g.event_date),
      createdAt: g.created_at,
      photoCount: g.photos[0]?.count ?? 0,
      bytes: usage.perGallery.get(g.id) ?? 0,
      locked: Boolean(g.password_hash),
      expired: Boolean(g.expires_at && new Date(g.expires_at) < new Date()),
      cover: g.cover_photo_id ? await presignGet(variantKey(g.id, g.cover_photo_id, "thumb")) : null,
    })),
  );

  return (
    <div>
      <div className="mb-8 empty:hidden">
        <StorageAlert used={usage.total} limit={usage.limit} />
      </div>
      <GalleryGrid galleries={galleries} />
      <div className="mt-20">
        <StorageMeter used={usage.total} limit={usage.limit} parts={storageParts(overview)} />
      </div>
      <div className="mt-4 border-t border-line pt-8">
        <StorageCheck />
      </div>
    </div>
  );
}
