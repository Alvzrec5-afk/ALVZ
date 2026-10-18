import type { BoardItemInput } from "@/lib/board-types";
import { applyBoardOps, boardImageKey, clientActor, findSharedBoard, isUuid } from "@/lib/boards";
import { putObject } from "@/lib/storage";
import { createServiceClient } from "@/lib/supabase/server";
import { storageUsage } from "@/lib/usage";

/** Une image préparée par le navigateur pèse ~450 Ko : au-delà, refus. */
const MAX_CLIENT_IMAGE_BYTES = 1.5 * 1024 * 1024;
const MAX_CLIENT_IMAGES = 150;

/**
 * Le client ajoute une image d'inspiration. Contrairement au studio, le fichier passe par le serveur :
 * taille et format sont vérifiés (une adresse d'envoi directe ne limiterait pas la taille).
 * La carte est créée ici même, donc aucun fichier orphelin.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const board = await findSharedBoard((await params).slug);
  if (!board) return Response.json({ error: "Tableau introuvable" }, { status: 404 });
  if (!board.client_can_add) return Response.json({ error: "Ce tableau est en lecture seule." }, { status: 403 });
  const actor = await clientActor(board);
  if (actor.role !== "client" || !actor.clientId) return Response.json({ error: "Indiquez d'abord votre prénom." }, { status: 401 });

  let item: BoardItemInput;
  try {
    item = JSON.parse(req.headers.get("x-board-item") ?? "");
  } catch {
    return Response.json({ error: "Image invalide" }, { status: 400 });
  }
  if (!item || item.kind !== "image" || !isUuid(item.id)) return Response.json({ error: "Image invalide" }, { status: 400 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_CLIENT_IMAGE_BYTES) {
    return Response.json({ error: "Image trop lourde" }, { status: 413 });
  }
  const body = new Uint8Array(await req.arrayBuffer());
  const jpeg = body.length > 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  if (!jpeg || body.length > MAX_CLIENT_IMAGE_BYTES) return Response.json({ error: "Image invalide" }, { status: 400 });

  const db = createServiceClient();
  const [{ data: existing }, { count }, usage] = await Promise.all([
    db.from("board_items").select("id").eq("id", item.id).maybeSingle(),
    db.from("board_items").select("id", { count: "exact", head: true }).eq("board_id", board.id).eq("client_id", actor.clientId).eq("kind", "image"),
    storageUsage(db),
  ]);
  // Uniquement pour une nouvelle carte : impossible de remplacer l'image de quelqu'un d'autre.
  if (existing) return Response.json({ error: "Image déjà envoyée" }, { status: 409 });
  if ((count ?? 0) >= MAX_CLIENT_IMAGES) return Response.json({ error: `${MAX_CLIENT_IMAGES} images maximum par personne.` }, { status: 413 });
  if (usage.total + body.length > usage.limit) return Response.json({ error: "Stockage du studio plein." }, { status: 413 });

  try {
    await putObject(boardImageKey(board.id, item.id), body, "image/jpeg");
    await applyBoardOps(db, board.id, [{ op: "put", item: { ...item, sizeBytes: body.length } }], actor, { clientImage: true });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 });
  }
}
