import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { boardAncestors, isUuid, loadBoardItems } from "@/lib/boards";
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
  const fields = "id, title, gallery_id, share_slug, share_enabled, client_can_add, client_can_edit";
  const [{ data: board }, items, { data: galleries }, path] = await Promise.all([
    supabase.from("boards").select(fields).eq("id", id).maybeSingle(),
    loadBoardItems(supabase, id, { role: "admin" }),
    supabase.from("galleries").select("id, title, kind").order("created_at", { ascending: false }),
    boardAncestors(supabase, id),
  ]);
  if (!board) notFound();
  // Sous-tableau : le partage et la galerie reliée sont ceux du tableau principal.
  const root = path.length > 1 ? (await supabase.from("boards").select(fields).eq("id", path[0].id).maybeSingle()).data ?? board : board;

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
