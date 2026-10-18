import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  isHex,
  MAX_WIDTH,
  MIN_WIDTH,
  NOTE_COLORS,
  TABLE_MAX_COLS,
  TABLE_MAX_ROWS,
  type BoardData,
  type BoardItem,
  type BoardItemInput,
  type BoardKind,
  type BoardOp,
} from "@/lib/board-types";
import { copyObject, deleteKeys, presignGet } from "@/lib/storage";
import { createServiceClient } from "@/lib/supabase/server";
import { newSlug, sign, unsign } from "@/lib/tokens";
import { storageUsage } from "@/lib/usage";

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
  const rows = (data ?? []) as Row[];
  const subs = await subBoardPreviews(db, boardId);
  return Promise.all(
    rows.map(async (r) => ({
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
      sub: r.kind === "board" && r.data?.boardId ? subs.get(r.data.boardId) ?? null : undefined,
    })),
  );
}

/** Aperçu des sous-tableaux d'un tableau : nom, nombre de cartes, 4 images au plus. */
async function subBoardPreviews(db: SupabaseClient, boardId: string) {
  const out = new Map<string, { title: string; count: number; covers: string[] }>();
  const { data: boards } = await db.from("boards").select("id, title").eq("parent_id", boardId);
  if (!boards?.length) return out;
  const { data: items } = await db
    .from("board_items")
    .select("id, board_id, kind, size_bytes, z")
    .in("board_id", boards.map((b) => b.id as string))
    .neq("kind", "arrow");
  for (const b of boards) {
    const mine = (items ?? []).filter((i) => i.board_id === b.id);
    const images = mine.filter((i) => i.kind === "image" && Number(i.size_bytes) > 0).sort((x, y) => Number(y.z) - Number(x.z));
    out.set(b.id as string, {
      title: b.title as string,
      count: mine.length,
      covers: await Promise.all(images.slice(0, 4).map((i) => presignGet(boardImageKey(b.id as string, i.id as string)))),
    });
  }
  return out;
}

/** Chemin depuis le tableau principal jusqu'à ce tableau (fil d'Ariane), du haut vers le bas. */
export async function boardAncestors(db: SupabaseClient, boardId: string) {
  const chain: { id: string; title: string; parent_id: string | null }[] = [];
  let id: string | null = boardId;
  for (let depth = 0; id && depth < 25; depth++) {
    const { data }: { data: { id: string; title: string; parent_id: string | null } | null } = await db
      .from("boards")
      .select("id, title, parent_id")
      .eq("id", id)
      .maybeSingle();
    if (!data) break;
    chain.unshift(data);
    id = data.parent_id;
  }
  return chain;
}

const num = (v: unknown, min: number, max: number, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Ne garde que les champs attendus pour chaque type de carte. */
function cleanData(kind: BoardKind, raw: BoardData): BoardData {
  const d = raw && typeof raw === "object" ? raw : {};
  const tint = {
    color: d.color && d.color in NOTE_COLORS ? d.color : undefined,
    hex: isHex(d.hex) ? d.hex.toLowerCase() : undefined,
  };
  const withTint = (data: BoardData): BoardData => ({ ...data, ...(kind === "color" || kind === "arrow" ? {} : tint) });
  return withTint(cleanKind(kind, d));
}

/** Champs propres à chaque type (la couleur de fond est ajoutée par `cleanData`). */
function cleanKind(kind: BoardKind, d: BoardData): BoardData {
  switch (kind) {
    case "note":
      return { text: text(d.text, 5000) ?? "", color: d.color && d.color in NOTE_COLORS ? d.color : "blanc", hex: isHex(d.hex) ? d.hex.toLowerCase() : undefined };
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
      return { title: text(d.title, 200) ?? "", color: d.color && d.color in NOTE_COLORS ? d.color : "blanc", hex: isHex(d.hex) ? d.hex.toLowerCase() : undefined };
    case "arrow":
      return { from: isUuid(d.from) ? d.from : undefined, to: isUuid(d.to) ? d.to : undefined };
    case "color":
      return { hex: isHex(d.hex) ? d.hex.toLowerCase() : "#c8a27a", title: text(d.title, 100) ?? "" };
    case "link": {
      const url = text(d.url, 2000)?.trim() ?? "";
      return { url: /^https?:\/\//i.test(url) ? url : "", title: text(d.title, 200) ?? "" };
    }
    case "board":
      return { boardId: isUuid(d.boardId) ? d.boardId : undefined, title: text(d.title, 200) ?? "" };
    case "table": {
      // Grille rectangulaire, bornée (60 lignes × 12 colonnes, 1000 caractères par cellule).
      const rows = (Array.isArray(d.cells) ? d.cells : []).slice(0, TABLE_MAX_ROWS).map((r) => (Array.isArray(r) ? r : []));
      const cols = Math.min(TABLE_MAX_COLS, Math.max(1, ...rows.map((r) => r.length)));
      const cells = rows.map((r) => Array.from({ length: cols }, (_, i) => text(r[i], 1000) ?? ""));
      return { cells: cells.length ? cells : [Array.from({ length: cols }, () => "")] };
    }
  }
}

const KINDS: BoardKind[] = ["note", "image", "todo", "column", "arrow", "board", "color", "link", "table"];
const CLIENT_KINDS: BoardKind[] = ["note", "todo", "link", "table"];

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
    ? await db.from("board_items").select("id, board_id, kind, client_id, author, size_bytes, data").in("id", lookup)
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
  const subBoards: { id: string; title: string }[] = []; // cartes « tableau » créées ou renommées
  const deletedSubBoards: string[] = [];
  const freedKeys: string[] = [];
  const now = new Date().toISOString();

  for (const o of ops) {
    if (o.op === "delete") {
      const row = known.get(o.id);
      if (!row) continue;
      if (!owns(row)) throw new Error("Carte non modifiable");
      deletes.push(o.id);
      if (row.kind === "image") freedKeys.push(boardImageKey(boardId, o.id));
      if (row.kind === "board" && isUuid((row.data as BoardData | null)?.boardId)) deletedSubBoards.push((row.data as BoardData).boardId!);
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
    const data = cleanData(it.kind, it.data);
    if (it.kind === "board") {
      // La carte garde toujours le même sous-tableau ; à la création, il en faut un nouveau.
      const before = row?.data as BoardData | null;
      data.boardId = before?.boardId ?? data.boardId ?? crypto.randomUUID();
      // Nom du sous-tableau : seulement à la création ou si la carte a vraiment été renommée.
      if (!row || (before?.title ?? "") !== (data.title ?? "")) subBoards.push({ id: data.boardId, title: data.title || "Sans titre" });
    }
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
      data,
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
  if (subBoards.length) {
    // Sous-tableaux : créés au premier envoi de leur carte, renommés ensuite avec elle.
    const { data: known } = await db.from("boards").select("id, parent_id").in("id", subBoards.map((b) => b.id));
    const existing = new Map((known ?? []).map((b) => [b.id as string, b.parent_id as string | null]));
    if ([...existing.values()].some((parent) => parent !== boardId)) throw new Error("Tableau invalide");
    const fresh = subBoards.filter((b) => !existing.has(b.id));
    if (fresh.length) {
      const { error: subError } = await db
        .from("boards")
        .insert(fresh.map((b) => ({ id: b.id, title: b.title, parent_id: boardId, share_slug: newSlug() })));
      if (subError) throw new Error(subError.message);
    }
    await Promise.all(
      subBoards.filter((b) => existing.has(b.id)).map((b) => db.from("boards").update({ title: b.title }).eq("id", b.id).eq("parent_id", boardId)),
    );
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
    for (const sub of deletedSubBoards) await purgeBoard(db, sub, boardId);
  }
  await db.from("boards").update({ updated_at: now }).eq("id", boardId);
}

/**
 * Copie complète d'un tableau : cartes, colonnes, flèches, planches (à toutes les profondeurs) et images.
 * Les identifiants sont renouvelés ; la copie n'est pas partagée (nouveau lien, partage désactivé).
 */
export async function duplicateBoard(db: SupabaseClient, sourceId: string, title: string) {
  // Tous les tableaux à copier, du haut vers le bas.
  const tree: { id: string; title: string; parent_id: string | null; gallery_id: string | null; client_can_add: boolean }[] = [];
  const { data: top } = await db.from("boards").select("id, title, parent_id, gallery_id, client_can_add").eq("id", sourceId).maybeSingle();
  if (!top) throw new Error("Tableau introuvable");
  tree.push(top);
  for (let level = [sourceId], depth = 0; level.length && depth < 25; depth++) {
    const { data } = await db.from("boards").select("id, title, parent_id, gallery_id, client_can_add").in("parent_id", level);
    tree.push(...(data ?? []));
    level = (data ?? []).map((b) => b.id as string);
  }
  const { data: rows, error } = await db
    .from("board_items")
    .select("id, board_id, kind, x, y, w, z, parent_id, position, data, size_bytes, author")
    .in("board_id", tree.map((b) => b.id));
  if (error) throw new Error(error.message);
  const items = rows ?? [];

  const imageBytes = items.filter((i) => i.kind === "image").reduce((n, i) => n + Number(i.size_bytes), 0);
  const usage = await storageUsage(db);
  if (usage.total + imageBytes > usage.limit) throw new Error("Stockage plein : impossible de copier les images de ce tableau.");

  const boardIds = new Map(tree.map((b) => [b.id, crypto.randomUUID()]));
  const itemIds = new Map(items.map((i) => [i.id as string, crypto.randomUUID()]));
  const { error: boardError } = await db.from("boards").insert(
    tree.map((b) => ({
      id: boardIds.get(b.id),
      title: b.id === sourceId ? title : b.title,
      parent_id: b.id === sourceId ? top.parent_id : boardIds.get(b.parent_id!),
      gallery_id: b.gallery_id,
      client_can_add: b.client_can_add,
      share_slug: newSlug(),
    })),
  );
  if (boardError) throw new Error(boardError.message);

  const copies = items.map((i) => {
    const d = { ...((i.data as BoardData) ?? {}) };
    if (i.kind === "board" && d.boardId) d.boardId = boardIds.get(d.boardId) ?? d.boardId;
    if (i.kind === "arrow") {
      d.from = d.from ? itemIds.get(d.from) : undefined;
      d.to = d.to ? itemIds.get(d.to) : undefined;
    }
    return {
      id: itemIds.get(i.id as string),
      board_id: boardIds.get(i.board_id as string),
      kind: i.kind,
      x: i.x,
      y: i.y,
      w: i.w,
      z: i.z,
      parent_id: i.parent_id ? itemIds.get(i.parent_id as string) ?? null : null,
      position: i.position,
      data: d,
      size_bytes: i.size_bytes,
      author: i.author,
      client_id: null,
    };
  });
  // Colonnes d'abord (les cartes rangées dedans y font référence), par paquets.
  copies.sort((a, b) => Number(a.kind !== "column") - Number(b.kind !== "column"));
  for (let i = 0; i < copies.length; i += 500) {
    const { error: itemError } = await db.from("board_items").insert(copies.slice(i, i + 500));
    if (itemError) throw new Error(itemError.message);
  }
  const images = items.filter((i) => i.kind === "image" && Number(i.size_bytes) > 0);
  for (let i = 0; i < images.length; i += 8) {
    await Promise.all(
      images.slice(i, i + 8).map((img) =>
        copyObject(boardImageKey(img.board_id as string, img.id as string), boardImageKey(boardIds.get(img.board_id as string)!, itemIds.get(img.id as string)!)).catch(
          () => undefined, // image manquante : la carte reste, sans image
        ),
      ),
    );
  }
  return boardIds.get(sourceId)!;
}

/** Supprime un tableau, ses sous-tableaux, leurs cartes et leurs images. */
export async function purgeBoard(db: SupabaseClient, boardId: string, expectedParent?: string) {
  if (expectedParent) {
    const { data } = await db.from("boards").select("parent_id").eq("id", boardId).maybeSingle();
    if (!data || data.parent_id !== expectedParent) return;
  }
  // Tous les tableaux contenus, à n'importe quelle profondeur.
  const all = [boardId];
  for (let level = [boardId], depth = 0; level.length && depth < 25; depth++) {
    const { data } = await db.from("boards").select("id").in("parent_id", level);
    level = (data ?? []).map((b) => b.id as string);
    all.push(...level);
  }
  const { data: images } = await db.from("board_items").select("id, board_id").in("board_id", all).eq("kind", "image");
  if (images?.length) await deleteKeys(images.map((r) => boardImageKey(r.board_id as string, r.id as string)));
  // Les sous-tableaux disparaissent avec le tableau (suppression en cascade).
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

/**
 * Tableau partagé ou l'un de ses sous-tableaux (`/t/<lien>/b/<id>`) : le sous-tableau doit se trouver
 * sous le tableau partagé. Le prénom du visiteur et l'option « ajouter ses idées » viennent du tableau partagé.
 */
export async function resolveSharedBoard(slug: string, subId?: string | null) {
  const root = await findSharedBoard(slug);
  if (!root) return null;
  if (!subId || subId === root.id) return { root, board: { id: root.id, title: root.title }, path: [{ id: root.id, title: root.title }] };
  if (!isUuid(subId)) return null;
  const chain = await boardAncestors(createServiceClient(), subId);
  const at = chain.findIndex((b) => b.id === root.id);
  if (at < 0) return null;
  const path = chain.slice(at).map((b) => ({ id: b.id, title: b.title }));
  return { root, board: path[path.length - 1], path };
}
