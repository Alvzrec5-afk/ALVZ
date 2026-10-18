import { addBoardComment, clientActor, deleteBoardComment, resolveSharedBoard } from "@/lib/boards";
import { createServiceClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ slug: string }> };

/** Le client répond dans une carte « commentaire » (signé de son prénom). */
async function visitor(req: Request, params: Ctx["params"]) {
  const shared = await resolveSharedBoard((await params).slug, new URL(req.url).searchParams.get("board"));
  if (!shared) return { error: Response.json({ error: "Tableau introuvable" }, { status: 404 }) } as const;
  if (!shared.root.client_can_add) return { error: Response.json({ error: "Ce tableau est en lecture seule." }, { status: 403 }) } as const;
  const actor = await clientActor(shared.root);
  if (actor.role !== "client" || !actor.clientId) return { error: Response.json({ error: "Indiquez d'abord votre prénom." }, { status: 401 }) } as const;
  return { board: shared.board, actor } as const;
}

export async function POST(req: Request, { params }: Ctx) {
  const v = await visitor(req, params);
  if ("error" in v) return v.error;
  try {
    const { itemId, body } = (await req.json()) as { itemId: string; body: string };
    return Response.json(await addBoardComment(createServiceClient(), v.board.id, itemId, String(body ?? ""), v.actor));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const v = await visitor(req, params);
  if ("error" in v) return v.error;
  await deleteBoardComment(createServiceClient(), v.board.id, new URL(req.url).searchParams.get("id") ?? "", v.actor);
  return Response.json({ ok: true });
}
