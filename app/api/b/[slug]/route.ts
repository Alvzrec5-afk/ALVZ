import type { BoardOp } from "@/lib/board-types";
import { applyBoardOps, clientActor, findSharedBoard, loadBoardItems } from "@/lib/boards";
import { createServiceClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ slug: string }> };
const notFound = () => Response.json({ error: "Tableau introuvable" }, { status: 404 });

/** Tableau partagé : lecture pour tous ceux qui ont le lien. */
export async function GET(_: Request, { params }: Ctx) {
  const board = await findSharedBoard((await params).slug);
  if (!board) return notFound();
  try {
    return Response.json({ items: await loadBoardItems(createServiceClient(), board.id, await clientActor(board)) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 });
  }
}

/** Le client ajoute ou modifie ses propres cartes (si le studio l'autorise). */
export async function POST(req: Request, { params }: Ctx) {
  const board = await findSharedBoard((await params).slug);
  if (!board) return notFound();
  if (!board.client_can_add) return Response.json({ error: "Ce tableau est en lecture seule." }, { status: 403 });
  const actor = await clientActor(board);
  if (actor.role !== "client" || !actor.clientId) return Response.json({ error: "Indiquez d'abord votre prénom." }, { status: 401 });
  try {
    const { ops } = (await req.json()) as { ops: BoardOp[] };
    await applyBoardOps(createServiceClient(), board.id, ops, actor);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 400 });
  }
}
