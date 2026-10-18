"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminApi } from "@/lib/auth";
import { TEMPLATES, templateItems, type TemplateId } from "@/lib/board-types";
import { applyBoardOps, duplicateBoard as copyBoard, isUuid, purgeBoard } from "@/lib/boards";
import { newSlug } from "@/lib/tokens";
import type { FormState } from "./actions";

async function insertBoard(title: string, template: TemplateId, galleryId: string | null) {
  const { supabase } = await requireAdminApi();
  const { data, error } = await supabase
    .from("boards")
    .insert({ title, gallery_id: galleryId, share_slug: newSlug() })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const items = templateItems(template);
  if (items.length) await applyBoardOps(supabase, data.id, items.map((item) => ({ op: "put" as const, item })), { role: "admin" });
  revalidatePath("/admin/boards");
  return { id: data.id as string };
}

export async function createBoard(_: FormState, form: FormData): Promise<FormState> {
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  if (!title) return { error: "Donnez un nom au tableau." };
  const raw = String(form.get("template") ?? "vide");
  const template = (raw in TEMPLATES ? raw : "vide") as TemplateId;
  const gallery = String(form.get("gallery_id") ?? "");
  const res = await insertBoard(title, template, isUuid(gallery) ? gallery : null);
  if ("error" in res) return { error: res.error };
  redirect(`/admin/boards/${res.id}${template === "milanote" ? "?import=1" : ""}`);
}

/** Depuis une galerie ou un projet vidéo : ouvre son tableau de préparation (créé au premier clic). */
export async function openGalleryBoard(galleryId: string) {
  const { supabase } = await requireAdminApi();
  const { data: existing } = await supabase
    .from("boards")
    .select("id")
    .eq("gallery_id", galleryId)
    .is("parent_id", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (existing) redirect(`/admin/boards/${existing.id}`);
  const { data: g } = await supabase.from("galleries").select("title, kind").eq("id", galleryId).maybeSingle();
  if (!g) redirect("/admin/boards");
  const res = await insertBoard(`Préparation — ${g.title}`, g.kind === "video" ? "clip" : "shooting", galleryId);
  if ("error" in res) throw new Error(res.error);
  redirect(`/admin/boards/${res.id}`);
}

export async function updateBoard(
  boardId: string,
  patch: { title?: string; share_enabled?: boolean; client_can_add?: boolean; client_can_edit?: boolean; gallery_id?: string | null },
) {
  const { supabase } = await requireAdminApi();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.title === "string") {
    const title = patch.title.trim().slice(0, 200);
    if (!title) return { error: "Nom vide" };
    update.title = title;
  }
  if (typeof patch.share_enabled === "boolean") update.share_enabled = patch.share_enabled;
  if (typeof patch.client_can_add === "boolean") update.client_can_add = patch.client_can_add;
  if (typeof patch.client_can_edit === "boolean") update.client_can_edit = patch.client_can_edit;
  if (patch.gallery_id === null || isUuid(patch.gallery_id)) update.gallery_id = patch.gallery_id;
  const { data: board, error } = await supabase.from("boards").update(update).eq("id", boardId).select("parent_id").maybeSingle();
  if (error) return { error: error.message };
  // Sous-tableau renommé : la carte qui l'ouvre, dans le tableau parent, prend le même nom.
  if (typeof update.title === "string" && board?.parent_id) {
    const { data: card } = await supabase
      .from("board_items")
      .select("id, data")
      .eq("board_id", board.parent_id)
      .eq("kind", "board")
      .eq("data->>boardId", boardId)
      .maybeSingle();
    if (card) await supabase.from("board_items").update({ data: { ...(card.data as object), title: update.title } }).eq("id", card.id);
    revalidatePath(`/admin/boards/${board.parent_id}`);
  }
  revalidatePath(`/admin/boards/${boardId}`);
  revalidatePath("/admin/boards");
  return {};
}

/** Nouveau lien de partage : l'ancien ne fonctionne plus. */
export async function regenerateBoardLink(boardId: string) {
  const { supabase } = await requireAdminApi();
  const slug = newSlug();
  const { error } = await supabase.from("boards").update({ share_slug: slug }).eq("id", boardId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/boards/${boardId}`);
  return { slug };
}

export async function deleteBoard(boardId: string) {
  const { supabase } = await requireAdminApi();
  await purgeBoard(supabase, boardId);
  revalidatePath("/admin/boards");
  redirect("/admin/boards");
}

/** Duplique un tableau (avec ses planches et images). Une planche dupliquée reste rangée au même endroit. */
export async function duplicateBoard(boardId: string, title?: string) {
  const { supabase } = await requireAdminApi();
  const { data: board } = await supabase.from("boards").select("title, parent_id").eq("id", boardId).maybeSingle();
  if (!board) return { error: "Tableau introuvable" };
  try {
    const name = (title ?? "").trim().slice(0, 200) || `${board.title} (copie)`;
    const id = await copyBoard(supabase, boardId, name);
    if (board.parent_id) {
      // La copie d'une planche apparaît comme une nouvelle carte à côté de l'originale.
      const { data: card } = await supabase
        .from("board_items")
        .select("x, y, w, z")
        .eq("board_id", board.parent_id)
        .eq("kind", "board")
        .eq("data->>boardId", boardId)
        .maybeSingle();
      await supabase.from("board_items").insert({
        id: crypto.randomUUID(),
        board_id: board.parent_id,
        kind: "board",
        x: (card?.x ?? 0) + 40,
        y: (card?.y ?? 0) + 40,
        w: card?.w ?? 200,
        z: (card?.z ?? 0) + 1,
        data: { boardId: id, title: name },
      });
      revalidatePath(`/admin/boards/${board.parent_id}`);
    }
    revalidatePath("/admin/boards");
    return { id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Duplication impossible" };
  }
}
