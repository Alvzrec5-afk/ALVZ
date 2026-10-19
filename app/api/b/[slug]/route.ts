import type { BoardOp } from "@/lib/board-types";
import { applyBoardOps, boardVersion, resolveSharedBoard, clientActor, loadBoardItems } from "@/lib/boards";
import { createServiceClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ slug: string }> };
const notFound = () => Response.json({ error: "Tableau introuvable" }, { status: 404 });

/** Tableau partagé : lecture pour tous ceux qui ont le lien. */
export async function GET(req: Request, { params }: Ctx) {
  // ?board=<id> : un sous-tableau du tableau partagé ; prénom et droits viennent du tableau partagé.
  const shared = await resolveSharedBoard((await params).slug, new URL(req.url).searchParams.get("board"));
  if (!shared) return notFound();
  const { root, board } = shared;
  try {
    const db = createServiceClient();
    // `?v=` : version déjà connue → une seule petite lecture tant que rien n'a changé.
    const known = new URL(req.url).searchParams.get("v");
    const v = await boardVersion(db, board.id);
    if (known && v === known) return Response.json({ unchanged: true, v });
    return Response.json({ v, items: await loadBoardItems(db, board.id, await clientActor(root)) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 });
  }
}

/** Le client ajoute ou modifie ses propres cartes (si le studio l'autorise). */
export async function POST(req: Request, { params }: Ctx) {
  // ?board=<id> : un sous-tableau du tableau partagé ; prénom et droits viennent du tableau partagé.
  const shared = await resolveSharedBoard((await params).slug, new URL(req.url).searchParams.get("board"));
  if (!shared) return notFound();
  const { root, board } = shared;
  if (!root.client_can_add) return Response.json({ error: "Ce tableau est en lecture seule." }, { status: 403 });
  const actor = await clientActor(root);
  if (actor.role !== "client" || !actor.clientId) return Response.json({ error: "Indiquez d'abord votre prénom." }, { status: 401 });
  try {
    const { ops } = (await req.json()) as { ops: BoardOp[] };
    await applyBoardOps(createServiceClient(), board.id, ops, actor);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 400 });
  }
}
