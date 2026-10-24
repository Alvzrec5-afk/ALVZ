import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { boardImageKey } from "@/lib/boards";
import { presignGet, variantKey, videoKey } from "@/lib/storage";
import type { RecentItem } from "@/components/admin/recent-projects";

type GalleryRow = { id: string; title: string; kind: string; created_at: string; updated_at: string; cover_photo_id: string | null };
type BoardRow = { id: string; title: string; updated_at: string; cover_key: string | null };

/**
 * Projets récents de l'Accueil : galeries, projets vidéo et tableaux mêlés (6 au plus, les plus récemment modifiés),
 * chacun avec une image : photo de couverture (ou 1re photo), affiche de la 1re vidéo, couverture du tableau (ou 1re image).
 */
export async function loadRecentProjects(supabase: SupabaseClient, galleries: GalleryRow[], boards: BoardRow[], perGallery: Map<string, number>): Promise<RecentItem[]> {
  const gal = (galleries ?? []).slice(0, 6);
  const brd = (boards ?? []).slice(0, 6);
  const photoGals = gal.filter((g) => g.kind !== "video");
  const videoGals = gal.filter((g) => g.kind === "video");
  const [{ data: firstPhotos }, { data: firstVideos }, { data: planches }] = await Promise.all([
    photoGals.length
      ? supabase.from("photos").select("id, gallery_id").in("gallery_id", photoGals.map((g) => g.id as string)).eq("status", "ready").order("position").limit(200)
      : Promise.resolve({ data: [] as { id: string; gallery_id: string }[] }),
    videoGals.length
      ? supabase.from("videos").select("id, gallery_id").in("gallery_id", videoGals.map((g) => g.id as string)).eq("status", "ready").order("position").limit(100)
      : Promise.resolve({ data: [] as { id: string; gallery_id: string }[] }),
    brd.length ? supabase.from("boards").select("id, parent_id").in("parent_id", brd.map((b) => b.id as string)).is("deleted_at", null) : Promise.resolve({ data: [] as { id: string; parent_id: string }[] }),
  ]);
  const rootOf = new Map<string, string>(brd.map((b) => [b.id as string, b.id as string]));
  for (const p of planches ?? []) rootOf.set(p.id as string, p.parent_id as string);
  const { data: boardImages } = rootOf.size
    ? await supabase
        .from("board_items")
        .select("id, board_id, z, data")
        .in("board_id", [...rootOf.keys()])
        .eq("kind", "image")
        .gt("size_bytes", 0)
        .is("deleted_at", null)
        .order("z", { ascending: false })
        .limit(300)
    : { data: [] as { id: string; board_id: string; z: number; data: unknown }[] };

  const firstOf = <T extends { gallery_id: string }>(rows: T[] | null, id: string) => (rows ?? []).find((r) => r.gallery_id === id);
  const boardCover = (id: string) => {
    const img = (boardImages ?? []).find((i) => rootOf.get(i.board_id as string) === id && !(i.data as { video?: boolean; media?: string } | null)?.video && !(i.data as { media?: string } | null)?.media);
    return img ? presignGet(boardImageKey(img.board_id as string, img.id as string)) : Promise.resolve(null);
  };

  return (
    await Promise.all([
      ...gal.map(async (g): Promise<RecentItem> => {
        const id = g.id as string;
        const video = g.kind === "video";
        let cover: string | null = null;
        if (video) {
          const v = firstOf(firstVideos as { id: string; gallery_id: string }[] | null, id);
          if (v) cover = await presignGet(videoKey(id, v.id, "poster.jpg"));
        } else {
          const photoId = (g.cover_photo_id as string | null) ?? firstOf(firstPhotos as { id: string; gallery_id: string }[] | null, id)?.id;
          if (photoId) cover = await presignGet(variantKey(id, photoId, "web"));
        }
        const created = g.created_at as string;
        const updated = (g.updated_at as string) || created;
        return {
          id,
          kind: video ? "video" : "photo",
          title: g.title as string,
          href: `/admin/galleries/${id}`,
          date: updated,
          created: Date.parse(updated) - Date.parse(created) < 60_000,
          bytes: perGallery.get(id) ?? 0,
          cover,
        };
      }),
      ...brd.map(async (b): Promise<RecentItem> => ({
        id: b.id as string,
        kind: "board",
        title: b.title as string,
        href: `/admin/boards/${b.id}`,
        date: b.updated_at as string,
        created: false,
        bytes: 0,
        cover: b.cover_key ? await presignGet(b.cover_key as string) : await boardCover(b.id as string),
      })),
    ])
  )
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 6);
}
