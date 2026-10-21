import { requireAdminPage } from "@/lib/auth";
import { boardImageKey } from "@/lib/boards";
import { presignGet, variantKey, videoKey } from "@/lib/storage";
import { storageUsage, studioOverview } from "@/lib/usage";
import { StudioDashboard, type RecentItem } from "@/components/admin/studio-dashboard";

export const metadata = { title: "Accueil" };
export const dynamic = "force-dynamic";

const DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

/** Nombre d'événements par jour sur les 14 derniers jours (le plus ancien d'abord), pour les petites courbes. */
function perDay(dates: (string | null | undefined)[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = today.getTime() - (DAYS - 1) * DAY;
  const out = Array.from({ length: DAYS }, () => 0);
  for (const d of dates) {
    if (!d) continue;
    const i = Math.floor((Date.parse(d) - start) / DAY);
    if (i >= 0 && i < DAYS) out[i]++;
  }
  return out;
}

/** Accueil du studio (centre de contrôle) : chiffres et activité, projets récents avec leurs images, stockage. */
export default async function StudioHome() {
  const { supabase } = await requireAdminPage();
  const since = new Date(Date.now() - DAYS * DAY).toISOString();
  const [o, usage, { data: galleries }, { data: boards }, { data: libraryRoots }, { data: photoDays }, { data: viewDays }, { data: itemDays }] =
    await Promise.all([
      studioOverview(supabase),
      storageUsage(supabase),
      supabase.from("galleries").select("id, title, kind, created_at, updated_at, cover_photo_id").is("deleted_at", null).order("updated_at", { ascending: false }),
      supabase
        .from("boards")
        .select("id, title, updated_at, cover_key")
        .is("parent_id", null)
        .is("deleted_at", null)
        .eq("is_template", false)
        .eq("is_library", false)
        .order("updated_at", { ascending: false }),
      supabase.from("boards").select("id").eq("is_library", true).is("parent_id", null),
      supabase.from("photos").select("created_at").gte("created_at", since),
      supabase.from("video_events").select("created_at").eq("kind", "view").gte("created_at", since),
      supabase.from("board_items").select("board_id, kind, created_at, updated_at").gte("updated_at", since),
    ]);

  const libIds = new Set((libraryRoots ?? []).map((b) => b.id as string));
  const activity = {
    photos: perDay((photoDays ?? []).map((r) => r.created_at as string)),
    videos: perDay((viewDays ?? []).map((r) => r.created_at as string)),
    boards: perDay((itemDays ?? []).filter((r) => !libIds.has(r.board_id as string)).map((r) => r.updated_at as string)),
    library: perDay((itemDays ?? []).filter((r) => libIds.has(r.board_id as string) && r.kind === "image").map((r) => r.created_at as string)),
  };

  // Projets récents : galeries, projets vidéo et tableaux mêlés, avec une image de couverture chacun.
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

  const recent: RecentItem[] = (
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
          bytes: usage.perGallery.get(id) ?? 0,
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

  return (
    <StudioDashboard
      o={o}
      usage={usage}
      activity={activity}
      recent={recent}
      galleries={(galleries ?? []).map((g) => ({ id: g.id as string, title: g.title as string, kind: g.kind as string }))}
      boards={(boards ?? []).map((b) => ({ id: b.id as string, title: b.title as string }))}
    />
  );
}
