import { adminApiWith, apiError } from "@/lib/auth";
import type { BoardOp } from "@/lib/board-types";
import { applyBoardOps, boardVersion, isUuid, loadBoardItems } from "@/lib/boards";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Cartes du tableau (rafraîchissement pendant que la page est ouverte). Avec `?v=` (version déjà connue),
 * une seule petite lecture suffit tant que rien n'a changé.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return Response.json({ error: "Tableau introuvable" }, { status: 404 });
    const known = new URL(req.url).searchParams.get("v");
    if (known) {
      const { supabase, result: v } = await adminApiWith((db) => boardVersion(db, id));
      if (v === known) return Response.json({ unchanged: true, v });
      return Response.json({ v, items: await loadBoardItems(supabase, id, { role: "admin" }) });
    }
    // Version lue avant (ou en même temps que) les cartes : au pire, on recharge une fois de trop.
    const { result } = await adminApiWith((db) => Promise.all([boardVersion(db, id), loadBoardItems(db, id, { role: "admin" })]));
    return Response.json({ v: result[0], items: result[1] });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return Response.json({ error: "Tableau introuvable" }, { status: 404 });
    const [{ supabase, result: board }, body] = await Promise.all([
      adminApiWith(async (db) => (await db.from("boards").select("id").eq("id", id).maybeSingle()).data),
      req.json() as Promise<{ ops: BoardOp[] }>,
    ]);
    if (!board) return Response.json({ error: "Tableau introuvable" }, { status: 404 });
    return Response.json({ ok: true, ...(await applyBoardOps(supabase, id, body.ops, { role: "admin" })) });
  } catch (e) {
    return apiError(e);
  }
}
