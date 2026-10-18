import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { isUuid, loadBoardItems } from "@/lib/boards";
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
  const [{ data: board }, items, { data: galleries }] = await Promise.all([
    supabase.from("boards").select("id, title, gallery_id, share_slug, share_enabled, client_can_add").eq("id", id).maybeSingle(),
    loadBoardItems(supabase, id, { role: "admin" }),
    supabase.from("galleries").select("id, title, kind").order("created_at", { ascending: false }),
  ]);
  if (!board) notFound();

  return (
    <div className="h-svh flex flex-col">
      <BoardHeader board={board} galleries={(galleries ?? []) as { id: string; title: string; kind: string }[]} />
      <div className="flex-1 min-h-0">
        <BoardCanvas
          initialItems={items}
          endpoint={`/api/admin/boards/${id}`}
          imageEndpoint={`/api/admin/boards/${id}/image`}
          role="admin"
          canAdd
          openImport={query.import === "1"}
        />
      </div>
    </div>
  );
}
