import { apiError, requireAdminApi } from "@/lib/auth";
import type { BoardOp } from "@/lib/board-types";
import { applyBoardOps, isUuid, loadBoardItems } from "@/lib/boards";

type Ctx = { params: Promise<{ id: string }> };

/** Cartes du tableau (rafraîchissement pendant que la page est ouverte). */
export async function GET(_: Request, { params }: Ctx) {
  try {
    const { supabase } = await requireAdminApi();
    const { id } = await params;
    if (!isUuid(id)) return Response.json({ error: "Tableau introuvable" }, { status: 404 });
    return Response.json({ items: await loadBoardItems(supabase, id, { role: "admin" }) });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { supabase } = await requireAdminApi();
    const { id } = await params;
    const { data: board } = isUuid(id) ? await supabase.from("boards").select("id").eq("id", id).maybeSingle() : { data: null };
    if (!board) return Response.json({ error: "Tableau introuvable" }, { status: 404 });
    const { ops } = (await req.json()) as { ops: BoardOp[] };
    await applyBoardOps(supabase, id, ops, { role: "admin" });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
