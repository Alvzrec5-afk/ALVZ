import { requireAdminPage } from "@/lib/auth";
import { storageUsage } from "@/lib/usage";
import { TrashList, type TrashEntry } from "@/components/admin/trash-list";

export const metadata = { title: "Corbeille" };
export const dynamic = "force-dynamic";

/** Galeries, projets vidéo et tableaux supprimés : récupérables 30 jours. */
export default async function TrashPage() {
  const { supabase } = await requireAdminPage();
  const [{ data: galleries }, { data: boards }, usage] = await Promise.all([
    supabase.from("galleries").select("id, title, kind, deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    supabase.from("boards").select("id, title, deleted_at").is("parent_id", null).not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    storageUsage(supabase),
  ]);
  const entries: TrashEntry[] = [
    ...(galleries ?? []).map((g) => ({
      kind: (g.kind === "video" ? "video" : "gallery") as TrashEntry["kind"],
      id: g.id as string,
      title: g.title as string,
      deletedAt: g.deleted_at as string,
      bytes: usage.perGallery.get(g.id as string) ?? 0,
    })),
    ...(boards ?? []).map((b) => ({ kind: "board" as const, id: b.id as string, title: b.title as string, deletedAt: b.deleted_at as string, bytes: 0 })),
  ];
  return <TrashList entries={entries} />;
}
