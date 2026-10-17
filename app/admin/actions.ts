"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminApi } from "@/lib/auth";
import { parisEndOfDay } from "@/lib/dates";
import { createSessionClient } from "@/lib/supabase/server";
import { newSlug } from "@/lib/tokens";

export type FormState = { error?: string; ok?: string } | null;

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

function readSettings(form: FormData) {
  const title = String(form.get("title") ?? "").trim();
  const eventDate = String(form.get("event_date") ?? "").trim();
  const expires = String(form.get("expires_at") ?? "").trim();
  return {
    title,
    event_date: eventDate || null,
    expires_at: expires ? parisEndOfDay(expires) : null,
    watermark: form.get("watermark") === "on",
    downloads_enabled: form.get("downloads_enabled") === "on",
    theme: form.get("theme") === "dark" ? "dark" : "light",
  };
}

export async function createGallery(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAdminApi();
  const settings = readSettings(form);
  if (!settings.title) return { error: "Le nom du client est obligatoire." };
  const password = String(form.get("password") ?? "");
  const { data, error } = await supabase
    .from("galleries")
    .insert({
      ...settings,
      slug: newSlug(),
      password_hash: password ? await bcrypt.hash(password, 10) : null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await supabase.from("collections").insert({ gallery_id: data.id, name: "Galerie", position: 0 });
  revalidatePath("/admin");
  redirect(`/admin/galleries/${data.id}`);
}

export async function updateGallery(galleryId: string, _: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAdminApi();
  const settings = readSettings(form);
  if (!settings.title) return { error: "Le nom du client est obligatoire." };
  const update: Record<string, unknown> = { ...settings, updated_at: new Date().toISOString() };
  const password = String(form.get("password") ?? "");
  if (form.get("remove_password") === "on") update.password_hash = null;
  else if (password) update.password_hash = await bcrypt.hash(password, 10);
  const { error } = await supabase.from("galleries").update(update).eq("id", galleryId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath("/admin");
  return { ok: "Modifications enregistrées." };
}

export async function regenerateLink(galleryId: string) {
  const { supabase } = await requireAdminApi();
  await supabase.from("galleries").update({ slug: newSlug() }).eq("id", galleryId);
  revalidatePath(`/admin/galleries/${galleryId}`);
}

export async function setCover(galleryId: string, photoId: string) {
  const { supabase } = await requireAdminApi();
  await supabase.from("galleries").update({ cover_photo_id: photoId }).eq("id", galleryId);
  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath("/admin");
}

export async function addCollection(galleryId: string, name: string) {
  const { supabase } = await requireAdminApi();
  const clean = name.trim();
  if (!clean) return { error: "Nom vide" };
  const { data: last } = await supabase
    .from("collections")
    .select("position")
    .eq("gallery_id", galleryId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("collections")
    .insert({ gallery_id: galleryId, name: clean, position: (last?.position ?? -1) + 1 });
  if (error) return { error: error.code === "23505" ? "Cette collection existe déjà." : error.message };
  revalidatePath(`/admin/galleries/${galleryId}`);
  return {};
}

export async function renameCollection(galleryId: string, collectionId: string, name: string) {
  const { supabase } = await requireAdminApi();
  const clean = name.trim();
  if (!clean) return { error: "Nom vide" };
  const { error } = await supabase.from("collections").update({ name: clean }).eq("id", collectionId);
  if (error) return { error: error.code === "23505" ? "Cette collection existe déjà." : error.message };
  revalidatePath(`/admin/galleries/${galleryId}`);
  return {};
}

export async function reorderCollections(galleryId: string, orderedIds: string[]) {
  const { supabase } = await requireAdminApi();
  await Promise.all(
    orderedIds.map((id, position) => supabase.from("collections").update({ position }).eq("id", id)),
  );
  revalidatePath(`/admin/galleries/${galleryId}`);
}
