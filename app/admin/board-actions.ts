"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminApi } from "@/lib/auth";
import { TEMPLATES, templateItems, type TemplateId } from "@/lib/board-types";
import { applyBoardOps, isUuid, purgeBoard } from "@/lib/boards";
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
  patch: { title?: string; share_enabled?: boolean; client_can_add?: boolean; gallery_id?: string | null },
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
  if (patch.gallery_id === null || isUuid(patch.gallery_id)) update.gallery_id = patch.gallery_id;
  const { error } = await supabase.from("boards").update(update).eq("id", boardId);
  if (error) return { error: error.message };
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
