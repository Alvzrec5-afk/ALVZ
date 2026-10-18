import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  MAX_WIDTH,
  MIN_WIDTH,
  NOTE_COLORS,
  type BoardData,
  type BoardItem,
  type BoardItemInput,
  type BoardKind,
  type BoardOp,
} from "@/lib/board-types";
import { deleteKeys, presignGet } from "@/lib/storage";
import { createServiceClient } from "@/lib/supabase/server";
import { sign, unsign } from "@/lib/tokens";

export const BOARD_ITEM_FIELDS = "id, kind, x, y, w, z, parent_id, position, data, size_bytes, author, client_id";
export const MAX_BOARD_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_ITEMS = 2000;

type Row = {
  id: string;
  kind: BoardKind;
  x: number;
  y: number;
  w: number;
  z: number;
  parent_id: string | null;
  position: number;
  data: BoardData;
  size_bytes: number;
  author: string | null;
  client_id: string | null;
};

/** Qui modifie le tableau : le studio (tout) ou un client (seulement ses propres cartes). */
export type Actor = { role: "admin" } | { role: "client"; clientId: string; name: string };

export function boardImageKey(boardId: string, itemId: string) {
  return `boards/${boardId}/${itemId}.jpg`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export async function loadBoardItems(db: SupabaseClient, boardId: string, actor: Actor): Promise<BoardItem[]> {
  const { data, error } = await db.from("board_items").select(BOARD_ITEM_FIELDS).eq("board_id", boardId).limit(MAX_ITEMS);
  if (error) throw new Error(`Impossible de charger le tableau : ${error.message}`);
  return Promise.all(
    ((data ?? []) as Row[]).map(async (r) => ({
      id: r.id,
      kind: r.kind,
      x: r.x,
      y: r.y,
      w: r.w,
      z: r.z,
      parentId: r.parent_id,
      position: r.position,
      data: r.data ?? {},
      author: r.author,
      mine: actor.role === "admin" || (r.client_id !== null && r.client_id === actor.clientId),
      src: r.kind === "image" && r.size_bytes > 0 ? await presignGet(boardImageKey(boardId, r.id)) : null,
    })),
  );
}

const num = (v: unknown, min: number, max: number, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Ne garde que les champs attendus pour chaque type de carte. */
function cleanData(kind: BoardKind, raw: BoardData): BoardData {
  const d = raw && typeof raw === "object" ? raw : {};
  switch (kind) {
    case "note":
      return { text: text(d.text, 5000) ?? "", color: d.color && d.color in NOTE_COLORS ? d.color : "blanc" };
    case "image":
      return {
        caption: text(d.caption, 300) ?? "",
        width: Math.round(num(d.width, 1, 10000, 4)),
        height: Math.round(num(d.height, 1, 10000, 3)),
      };
    case "todo":
      return {
        title: text(d.title, 200) ?? "",
        items: (Array.isArray(d.items) ? d.items : [])
          .slice(0, 200)
          .filter((e) => e && typeof e.id === "string")
          .map((e) => ({ id: e.id.slice(0, 64), text: text(e.text, 500) ?? "", done: Boolean(e.done) })),
      };
    case "column":
      return { title: text(d.title, 200) ?? "", color: d.color && d.color in NOTE_COLORS ? d.color : "blanc" };
    case "arrow":
      return { from: isUuid(d.from) ? d.from : undefined, to: isUuid(d.to) ? d.to : undefined };
  }
}

const KINDS: BoardKind[] = ["note", "image", "todo", "column", "arrow"];
const CLIENT_KINDS: BoardKind[] = ["note", "todo"];

/**
 * Applique une série de modifications. Toutes les cartes visées doivent appartenir au tableau ;
 * un client ne peut créer que des notes, images et listes, et ne touche qu'à ses propres cartes.
 */
export async function applyBoardOps(
  db: SupabaseClient,
  boardId: string,
  ops: BoardOp[],
  actor: Actor,
  /** Client : une carte image ne se crée qu'avec son fichier (route d'envoi), jamais seule. */
  opts: { clientImage?: boolean } = {},
) {
  if (!Array.isArray(ops) || ops.length === 0) return;
  if (ops.length > 500) throw new Error("Trop de modifications en une fois");
  const ids = [...new Set(ops.map((o) => (o.op === "put" ? o.item?.id : o.id)).filter(isUuid))];
  const parentIds = [
    ...new Set(ops.flatMap((o) => (o.op === "put" && isUuid(o.item?.parentId) ? [o.item.parentId] : []))),
  ];
  const lookup = [...new Set([...ids, ...parentIds])];
  const { data: existing, error } = lookup.length
    ? await db.from("board_items").select("id, board_id, kind, client_id, author, size_bytes").in("id", lookup)
    : { data: [], error: null };
  if (error) throw new Error(error.message);
  const known = new Map((existing ?? []).map((r) => [r.id as string, r]));

  const owns = (row: { board_id: string; client_id: string | null }) =>
    row.board_id === boardId && (actor.role === "admin" || row.client_id === actor.clientId);

  // Colonnes créées dans ce même envoi : on peut déjà y ranger des cartes.
  const newColumns = new Set(
    ops.flatMap((o) => (o.op === "put" && o.item?.kind === "column" && isUuid(o.item.id) && !known.has(o.item.id) ? [o.item.id] : [])),
  );
  const puts: Record<string, unknown>[] = [];
  const deletes: string[] = [];
  const freedKeys: string[] = [];
  const now = new Date().toISOString();

  for (const o of ops) {
    if (o.op === "delete") {
      const row = known.get(o.id);
      if (!row) continue;
      if (!owns(row)) throw new Error("Carte non modifiable");
      deletes.push(o.id);
      if (row.kind === "image") freedKeys.push(boardImageKey(boardId, o.id));
      continue;
    }
    const it = o.item as BoardItemInput;
    if (!it || !isUuid(it.id) || !KINDS.includes(it.kind)) throw new Error("Carte invalide");
    const row = known.get(it.id);
    if (row && !owns(row)) throw new Error("Carte non modifiable");
    if (row && row.kind !== it.kind) throw new Error("Carte invalide");
    if (!row && actor.role === "client" && !(it.kind === "image" ? opts.clientImage : CLIENT_KINDS.includes(it.kind))) {
      throw new Error("Carte non autorisée");
    }
    const parent = it.parentId ? known.get(it.parentId) : null;
    const parentOk =
      it.kind !== "column" &&
      it.kind !== "arrow" &&
      ((parent && parent.board_id === boardId && parent.kind === "column") || (it.parentId && newColumns.has(it.parentId)));
    puts.push({
      id: it.id,
      board_id: boardId,
      kind: it.kind,
      x: num(it.x, -1e6, 1e6),
      y: num(it.y, -1e6, 1e6),
      w: num(it.w, MIN_WIDTH, MAX_WIDTH, 240),
      z: num(it.z, -1e9, 1e9),
      parent_id: parentOk ? it.parentId : null,
      position: num(it.position, -1e12, 1e12),
      data: cleanData(it.kind, it.data),
      // La taille de l'image n'est enregistrée qu'à la création (après l'envoi du fichier).
      size_bytes: row ? row.size_bytes : it.kind === "image" ? Math.round(num(it.sizeBytes, 0, MAX_BOARD_IMAGE_BYTES)) : 0,
      // Toujours explicites : dans un envoi groupé, un champ absent serait remis à vide.
      ...(row
        ? { author: row.author, client_id: row.client_id }
        : actor.role === "client"
          ? { author: actor.name, client_id: actor.clientId }
          : { author: null, client_id: null }),
      updated_at: now,
    });
  }

  if (ids.some((id) => !known.has(id))) {
    const { count } = await db.from("board_items").select("id", { count: "exact", head: true }).eq("board_id", boardId);
    if ((count ?? 0) + puts.length > MAX_ITEMS) throw new Error("Tableau plein (2000 cartes maximum)");
  }
  // Colonnes d'abord : les cartes du même envoi peuvent y être rangées.
  for (const group of [puts.filter((p) => p.kind === "column"), puts.filter((p) => p.kind !== "column")]) {
    if (!group.length) continue;
    const { error: putError } = await db.from("board_items").upsert(group, { onConflict: "id" });
    if (putError) throw new Error(putError.message);
  }
  if (deletes.length) {
    const { error: delError } = await db.from("board_items").delete().eq("board_id", boardId).in("id", deletes);
    if (delError) throw new Error(delError.message);
    if (freedKeys.length) await deleteKeys(freedKeys);
  }
  await db.from("boards").update({ updated_at: now }).eq("id", boardId);
}

/** Supprime un tableau, ses cartes et ses images. */
export async function purgeBoard(db: SupabaseClient, boardId: string) {
  const { data } = await db.from("board_items").select("id").eq("board_id", boardId).eq("kind", "image");
  if (data?.length) await deleteKeys(data.map((r) => boardImageKey(boardId, r.id as string)));
  const { error } = await db.from("boards").delete().eq("id", boardId);
  if (error) throw new Error(error.message);
}

// ——— Partage client ———

export type PublicBoard = { id: string; title: string; share_slug: string; client_can_add: boolean; gallery_id: string | null };

export const findSharedBoard = cache(async (slug: string) => {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(slug)) return null;
  const { data } = await createServiceClient()
    .from("boards")
    .select("id, title, share_slug, client_can_add, gallery_id")
    .eq("share_slug", slug)
    .eq("share_enabled", true)
    .maybeSingle();
  return (data as PublicBoard | null) ?? null;
});

const visitorCookie = (boardId: string) => `b_${boardId}`;

/** Visiteur identifié par son prénom (cookie signé, valable un an). */
export async function boardVisitor(board: PublicBoard) {
  const store = await cookies();
  const value = unsign(store.get(visitorCookie(board.id))?.value);
  if (!value) return null;
  const [boardId, clientId, name] = value.split(":");
  if (boardId !== board.id || !clientId || !name) return null;
  return { clientId, name: decodeURIComponent(name) };
}

export async function setBoardVisitor(board: PublicBoard, clientId: string, name: string) {
  const store = await cookies();
  store.set(visitorCookie(board.id), sign(`${board.id}:${clientId}:${encodeURIComponent(name)}`), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clientActor(board: PublicBoard): Promise<Actor> {
  const visitor = await boardVisitor(board);
  return visitor ? { role: "client", ...visitor } : { role: "client", clientId: "", name: "" };
}
