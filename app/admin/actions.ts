"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminApi } from "@/lib/auth";
import { parisEndOfDay } from "@/lib/dates";
import { sanitizeContact } from "@/lib/contact";
import { pickDesign, sanitizeSettingsPatch } from "@/lib/design";
import { createSessionClient } from "@/lib/supabase/server";
import { newSlug } from "@/lib/tokens";
import { parseEuros } from "@/lib/finance";
import { createAgreedQuote } from "@/lib/calendar-server";
import { VIDEO_PURGE_FIELDS, purgeVideos } from "@/lib/videos";

export type FormState = { error?: string; ok?: string } | null;

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function createGallery(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAdminApi();
  const title = String(form.get("title") ?? "").trim();
  if (!title) return { error: "Le nom du client est obligatoire." };
  const eventDate = String(form.get("event_date") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const kind = form.get("kind") === "video" ? "video" : "photo";
  const { data, error } = await supabase
    .from("galleries")
    .insert({
      kind,
      title,
      event_date: eventDate || null,
      slug: newSlug(),
      password_hash: password ? await bcrypt.hash(password, 10) : null,
      design: { grid_style: "columns", grid_size: "large", cover_layout: "center", font_style: "sans" },
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  if (kind === "photo") await supabase.from("collections").insert({ gallery_id: data.id, name: "Galerie", position: 0 });
  // Prix convenu : devis déjà accepté, relié au projet (Finances suit les paiements, la date apparaît au calendrier).
  const price = parseEuros(String(form.get("price") ?? "").trim() || "0");
  if (price && price > 0) {
    try {
      await createAgreedQuote(supabase, { title, client_name: title, price_cents: price, gallery_id: data.id as string });
    } catch (e) {
      console.error("Devis du prix convenu impossible", e);
    }
  }
  revalidatePath(kind === "photo" ? "/admin/galleries" : "/admin/videos");
  redirect(`/admin/galleries/${data.id}`);
}

/** Modifie un ou plusieurs réglages (design, options, nom, date…). Les valeurs sont validées côté serveur. */
export async function updateGallerySettings(galleryId: string, patch: Record<string, unknown>) {
  const { supabase } = await requireAdminApi();
  const clean: Record<string, unknown> = sanitizeSettingsPatch(patch);
  const designPatch = pickDesign(patch);
  if (Object.keys(designPatch).length > 0) {
    const { data: current, error: readError } = await supabase.from("galleries").select("design").eq("id", galleryId).single();
    if (readError) return { error: readError.message };
    clean.design = { ...((current?.design as Record<string, unknown>) ?? {}), ...designPatch };
  }
  if (Object.keys(clean).length === 0) return { error: "Aucune modification valide" };
  const { error } = await supabase
    .from("galleries")
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq("id", galleryId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath("/admin", "layout");
  return {};
}

export async function setGalleryPassword(galleryId: string, password: string | null) {
  const { supabase } = await requireAdminApi();
  const { error } = await supabase
    .from("galleries")
    .update({ password_hash: password ? await bcrypt.hash(password, 10) : null, updated_at: new Date().toISOString() })
    .eq("id", galleryId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath("/admin", "layout");
  return {};
}

export async function setGalleryExpiry(galleryId: string, date: string | null) {
  const { supabase } = await requireAdminApi();
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Date invalide" };
  const { error } = await supabase
    .from("galleries")
    .update({ expires_at: date ? parisEndOfDay(date) : null, updated_at: new Date().toISOString() })
    .eq("id", galleryId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath("/admin", "layout");
  return {};
}

export async function regenerateLink(galleryId: string) {
  const { supabase } = await requireAdminApi();
  await supabase.from("galleries").update({ slug: newSlug() }).eq("id", galleryId);
  revalidatePath(`/admin/galleries/${galleryId}`);
}

/** Lien personnalisé, ex. « camille-hugo » → /g/camille-hugo */
export async function setGallerySlug(galleryId: string, raw: string) {
  const { supabase } = await requireAdminApi();
  const slug = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) {
    return { error: "Le lien doit contenir entre 3 et 64 caractères (lettres, chiffres et tirets)." };
  }
  const { error } = await supabase.from("galleries").update({ slug }).eq("id", galleryId);
  if (error) return { error: error.code === "23505" ? "Ce lien est déjà utilisé par une autre galerie." : error.message };
  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath("/admin", "layout");
  return { slug };
}

export async function setCover(galleryId: string, photoId: string) {
  const { supabase } = await requireAdminApi();
  await supabase.from("galleries").update({ cover_photo_id: photoId }).eq("id", galleryId);
  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath("/admin", "layout");
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

/** Coordonnées du studio (carte de visite des galeries). */
export async function saveContact(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAdminApi();
  const contact = sanitizeContact(Object.fromEntries(form.entries()));
  const { error } = await supabase
    .from("studio_settings")
    .upsert({ id: 1, contact, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { ok: "Coordonnées enregistrées." };
}

/** Vidéo : titre et autorisation de téléchargement. */
export async function updateVideo(galleryId: string, videoId: string, patch: { title?: string; downloads_enabled?: boolean }) {
  const { supabase } = await requireAdminApi();
  const update: Record<string, unknown> = {};
  if (typeof patch.title === "string") {
    const title = patch.title.trim().slice(0, 200);
    if (!title) return { error: "Titre vide" };
    update.title = title;
  }
  if (typeof patch.downloads_enabled === "boolean") update.downloads_enabled = patch.downloads_enabled;
  const { error } = await supabase.from("videos").update(update).eq("id", videoId).eq("gallery_id", galleryId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/galleries/${galleryId}`);
  return {};
}

export async function deleteVideo(galleryId: string, videoId: string) {
  const { supabase } = await requireAdminApi();
  const { data } = await supabase.from("videos").select(VIDEO_PURGE_FIELDS).eq("id", videoId).eq("gallery_id", galleryId);
  await purgeVideos(supabase, data ?? []);
  revalidatePath(`/admin/galleries/${galleryId}`);
  return {};
}

export async function reorderVideos(galleryId: string, orderedIds: string[]) {
  const { supabase } = await requireAdminApi();
  await Promise.all(orderedIds.map((id, i) => supabase.from("videos").update({ position: (i + 1) * 1000 }).eq("id", id).eq("gallery_id", galleryId)));
  revalidatePath(`/admin/galleries/${galleryId}`);
}

export async function setVideoCommentResolved(galleryId: string, commentId: string, resolved: boolean) {
  const { supabase } = await requireAdminApi();
  await supabase.from("video_comments").update({ resolved }).eq("id", commentId);
  revalidatePath(`/admin/galleries/${galleryId}`);
}

export async function deleteVideoComment(galleryId: string, commentId: string) {
  const { supabase } = await requireAdminApi();
  await supabase.from("video_comments").delete().eq("id", commentId);
  revalidatePath(`/admin/galleries/${galleryId}`);
}

/** Supprimer une galerie ou un projet vidéo = le mettre à la corbeille (récupérable 30 jours). */
export async function trashGallery(galleryId: string) {
  const { supabase } = await requireAdminApi();
  const { error } = await supabase.from("galleries").update({ deleted_at: new Date().toISOString() }).eq("id", galleryId);
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/videos");
  revalidatePath("/admin/trash");
  return {};
}
