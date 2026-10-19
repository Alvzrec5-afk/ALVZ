import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { requireAdminPage } from "@/lib/auth";
import { boardAncestors, isUuid, loadBoardItems, purgeDeletedItems, repairEmptyImages } from "@/lib/boards";
import { BoardCanvas } from "@/components/board/board-canvas";
import { BoardHeader } from "@/components/admin/board-header";

export const metadata = { title: "Tableau" };
export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ import?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const { supabase } = await requireAdminPage();
  const fields = "id, title, gallery_id, share_slug, share_enabled, client_can_add, client_can_edit, is_template, is_library";
  const [{ data: board }, items, { data: galleries }, path] = await Promise.all([
    supabase.from("boards").select(fields).eq("id", id).maybeSingle(),
    loadBoardItems(supabase, id, { role: "admin" }),
    supabase.from("galleries").select("id, title, kind").is("deleted_at", null).order("created_at", { ascending: false }),
    boardAncestors(supabase, id),
  ]);
  if (!board) notFound();
  if (path.some((b) => b.deleted_at)) redirect("/admin/trash");
  // Ménage (cartes supprimées il y a plus de 24 h) et cases photo à réparer : après l'affichage, sans faire attendre.
  after(() => Promise.all([purgeDeletedItems(supabase, id), repairEmptyImages(id)]).catch(() => undefined));
  // Sous-tableau : le partage et la galerie reliée sont ceux du tableau principal (déjà lu avec le chemin).
  const top = path.length > 1 ? path[0] : null;
  const root = !top
    ? board
    : "share_slug" in top
      ? (Object.fromEntries(fields.split(", ").map((f) => [f, top[f]])) as typeof board)
      : ((await supabase.from("boards").select(fields).eq("id", top.id).maybeSingle()).data ?? board);

  return (
    <div className="h-svh flex flex-col">
      <BoardHeader
        key={id}
        board={board}
        root={root}
        path={path.map((b) => ({ id: b.id, title: b.title }))}
        galleries={(galleries ?? []) as { id: string; title: string; kind: string }[]}
      />
      <div className="flex-1 min-h-0">
        <BoardCanvas
          key={id}
          boardBase="/admin/boards/"
          initialItems={items}
          endpoint={`/api/admin/boards/${id}`}
          commentsEndpoint={`/api/admin/boards/${id}/comments`}
          imageEndpoint={`/api/admin/boards/${id}/image`}
          role="admin"
          canAdd
          openImport={query.import === "1"}
        />
      </div>
    </div>
  );
}
