import { requireAdminPage } from "@/lib/auth";
import { formatLongDate } from "@/lib/dates";
import { presignGet, videoKey } from "@/lib/storage";
import { GalleryGrid, type GalleryCard } from "@/components/admin/gallery-grid";
import { StorageAlert, StorageMeter } from "@/components/admin/storage-meter";
import { storageParts, storageUsage, studioOverview } from "@/lib/usage";

export const metadata = { title: "Vidéos" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  slug: string;
  title: string;
  event_date: string | null;
  password_hash: string | null;
  expires_at: string | null;
  created_at: string;
  videos: { id: string; status: string; position: number }[];
};

/** Espace Vidéos : chaque projet (clip, film de mariage…) a son lien client, comme une galerie. */
export default async function VideosHome() {
  const { supabase } = await requireAdminPage();
  const [{ data, error }, usage, overview] = await Promise.all([
    supabase
      .from("galleries")
      .select("id, slug, title, event_date, password_hash, expires_at, created_at, videos(id, status, position)")
      .eq("kind", "video")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    storageUsage(supabase),
    studioOverview(supabase),
  ]);
  if (error) throw new Error(`Impossible de charger les projets vidéo : ${error.message}`);

  const projects: GalleryCard[] = await Promise.all(
    ((data ?? []) as Row[]).map(async (g) => {
      const ready = g.videos.filter((v) => v.status === "ready").sort((a, b) => a.position - b.position);
      return {
        id: g.id,
        slug: g.slug,
        title: g.title,
        date: formatLongDate(g.event_date),
        createdAt: g.created_at,
        photoCount: ready.length,
        bytes: usage.perGallery.get(g.id) ?? 0,
        locked: Boolean(g.password_hash),
        expired: Boolean(g.expires_at && new Date(g.expires_at) < new Date()),
        cover: ready[0] ? await presignGet(videoKey(g.id, ready[0].id, "poster.jpg")) : null,
      };
    }),
  );

  return (
    <div>
      <div className="mb-8 empty:hidden">
        <StorageAlert used={usage.total} limit={usage.limit} />
      </div>
      <GalleryGrid galleries={projects} kind="video" />
      <div className="mt-20">
        <StorageMeter used={usage.total} limit={usage.limit} parts={storageParts(overview)} />
      </div>
    </div>
  );
}
