import { apiError, requireAdminApi } from "@/lib/auth";
import { addBoardComment, deleteBoardComment, isUuid } from "@/lib/boards";

type Ctx = { params: Promise<{ id: string }> };

/** Le studio écrit dans une carte « commentaire » (signé ALVZ.REC). */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { supabase } = await requireAdminApi();
    const { id } = await params;
    if (!isUuid(id)) return Response.json({ error: "Tableau introuvable" }, { status: 404 });
    const { itemId, body } = (await req.json()) as { itemId: string; body: string };
    return Response.json(await addBoardComment(supabase, id, itemId, String(body ?? ""), { role: "admin" }));
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { supabase } = await requireAdminApi();
    const { id } = await params;
    await deleteBoardComment(supabase, id, new URL(req.url).searchParams.get("id") ?? "", { role: "admin" });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
