"use server";

import { revalidatePath } from "next/cache";
import { requireAdminApi } from "@/lib/auth";
import { formatBytes } from "@/lib/format";
import { GROUP_CATEGORIES, MAX_SITE_IMAGE_BYTES, PHOTO_CATEGORIES, type SiteSlug, cleanKit, siteItemKey, siteThumbKey, youtubeId, youtubeInfo } from "@/lib/site";
import { deleteKeys, objectSize, presignPut } from "@/lib/storage";
import { storageUsage } from "@/lib/usage";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const isSlug = (v: unknown): v is SiteSlug => (PHOTO_CATEGORIES as readonly unknown[]).includes(v) || (GROUP_CATEGORIES as readonly unknown[]).includes(v);
const fail = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) });
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
type Db = Awaited<ReturnType<typeof requireAdminApi>>["supabase"];

async function categoryId(db: Db, slug: SiteSlug) {
  const { data } = await db.from("site_categories").select("id").eq("slug", slug).maybeSingle();
  if (!data) throw new Error("Catégorie introuvable");
  return data.id as string;
}

/* ----- Clips (vidéos YouTube) ----- */

export async function addSiteClip(input: { link: string; artist: string; title: string; kind: string; start: number }): Promise<Result> {
  try {
    const { supabase } = await requireAdminApi();
    const id = youtubeId(input.link);
    if (!id) throw new Error("Lien YouTube non reconnu. Copiez l'adresse de la vidéo (youtube.com/watch?v=… ou youtu.be/…).");
    // Titre et artiste laissés vides : on les reprend de YouTube.
    const info = !text(input.title, 80) || !text(input.artist, 80) ? await youtubeInfo(id) : null;
    const title = text(input.title, 80) || text(info?.title, 80);
    const artist = text(input.artist, 80) || text(info?.artist, 80);
    if (!title) throw new Error("Titre introuvable sur YouTube : indiquez-le vous-même.");
    // Nouveau clip en haut de la liste, comme sur l'ancien site.
    const { data: first } = await supabase.from("site_clips").select("position").order("position").limit(1).maybeSingle();
    const { error } = await supabase.from("site_clips").insert({
      youtube_id: id,
      artist,
      title,
      kind: input.kind === "visualizer" || input.kind === "auto" && info?.kind === "visualizer" ? "visualizer" : "clip",
      start_at: Math.max(0, Math.min(36000, Math.round(Number(input.start) || 0))),
      position: (Number(first?.position) || 1) - 1,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/site");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateSiteClip(id: string, patch: { artist?: string; title?: string; kind?: string; start?: number }): Promise<Result> {
  try {
    const { supabase } = await requireAdminApi();
    if (!isUuid(id)) throw new Error("Requête invalide");
    const clean: Record<string, unknown> = {};
    if (patch.artist !== undefined) clean.artist = text(patch.artist, 80);
    if (patch.title !== undefined) {
      clean.title = text(patch.title, 80);
      if (!clean.title) throw new Error("Le titre ne peut pas être vide.");
    }
    if (patch.kind !== undefined) clean.kind = patch.kind === "visualizer" ? "visualizer" : "clip";
    if (patch.start !== undefined) clean.start_at = Math.max(0, Math.min(36000, Math.round(Number(patch.start) || 0)));
    const { error } = await supabase.from("site_clips").update(clean).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteSiteClip(id: string): Promise<Result> {
  try {
    const { supabase } = await requireAdminApi();
    if (!isUuid(id)) throw new Error("Requête invalide");
    const { error } = await supabase.from("site_clips").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/site");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reorderSiteClips(ids: string[]): Promise<Result> {
  try {
    const { supabase } = await requireAdminApi();
    if (!ids.every(isUuid)) throw new Error("Requête invalide");
    await Promise.all(ids.map((id, i) => supabase.from("site_clips").update({ position: i + 1 }).eq("id", id)));
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ----- Photos ----- */

/** Adresses d'envoi direct vers Oracle : grande version (2400 px) et vignette (1024 px). */
export async function prepareSitePhoto(size: number, thumbSize: number): Promise<Result<{ id: string; url: string; thumbUrl: string }>> {
  try {
    const { supabase } = await requireAdminApi();
    if (!(size > 0) || size > MAX_SITE_IMAGE_BYTES || !(thumbSize > 0) || thumbSize > MAX_SITE_IMAGE_BYTES) {
      throw new Error("Photo trop lourde");
    }
    const usage = await storageUsage(supabase);
    if (usage.total + size + thumbSize > usage.limit) throw new Error(`Stockage plein (${formatBytes(usage.total)} sur ${formatBytes(usage.limit)}).`);
    const id = crypto.randomUUID();
    const [url, thumbUrl] = await Promise.all([presignPut(siteItemKey(id), "image/jpeg"), presignPut(siteThumbKey(id), "image/jpeg")]);
    return { ok: true, id, url, thumbUrl };
  } catch (e) {
    return fail(e);
  }
}

/** Photo envoyée : ajoutée à la fin de sa catégorie (coulisses et matériel ont chacun leur propre ordre). */
export async function commitSitePhoto(slug: string, photo: { id: string; width: number; height: number }): Promise<Result> {
  try {
    const { supabase } = await requireAdminApi();
    if (!isSlug(slug) || !isUuid(photo.id)) throw new Error("Requête invalide");
    const [size, thumbSize, catId] = await Promise.all([objectSize(siteItemKey(photo.id)), objectSize(siteThumbKey(photo.id)), categoryId(supabase, slug)]);
    if (!size) throw new Error("La photo n'est pas arrivée, réessayez.");
    // Les photos des catégories se suivent dans un seul ordre (celui de « Tout » sur le site) ; coulisses et matériel : le leur.
    const ids = (GROUP_CATEGORIES as readonly string[]).includes(slug) ? [catId] : await Promise.all(PHOTO_CATEGORIES.map((s) => categoryId(supabase, s)));
    const { data: last } = await supabase.from("site_items").select("position").in("category_id", ids).order("position", { ascending: false }).limit(1).maybeSingle();
    const position = (Number(last?.position) || 0) + 1;
    const { error } = await supabase.from("site_items").insert({
      id: photo.id,
      category_id: catId,
      kind: "photo",
      ext: "jpg",
      width: Math.max(1, Math.round(photo.width) || 4),
      height: Math.max(1, Math.round(photo.height) || 3),
      size_bytes: size,
      thumb_size: thumbSize,
      position,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/site");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

async function removeItem(db: Db, id: string, external: boolean) {
  if (!external) await deleteKeys([siteItemKey(id), siteThumbKey(id)]).catch(() => undefined);
  const { error } = await db.from("site_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteSitePhoto(id: string): Promise<Result> {
  try {
    const { supabase } = await requireAdminApi();
    if (!isUuid(id)) throw new Error("Requête invalide");
    const { data: row } = await supabase.from("site_items").select("id, external_url").eq("id", id).maybeSingle();
    if (row) await removeItem(supabase, id, Boolean(row.external_url));
    revalidatePath("/admin/site");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Échange la place de deux photos (flèches ← → dans le studio). */
export async function swapSitePhotos(a: string, b: string): Promise<Result> {
  try {
    const { supabase } = await requireAdminApi();
    if (!isUuid(a) || !isUuid(b)) throw new Error("Requête invalide");
    const { data } = await supabase.from("site_items").select("id, position").in("id", [a, b]);
    const pa = data?.find((r) => r.id === a)?.position;
    const pb = data?.find((r) => r.id === b)?.position;
    if (pa === undefined || pb === undefined) throw new Error("Photo introuvable");
    // Même place (anciennes photos) : on les départage pour que l'échange se voie.
    const [na, nb] = pa === pb ? [Number(pb) + 0.5, Number(pa)] : [pb, pa];
    await Promise.all([supabase.from("site_items").update({ position: na }).eq("id", a), supabase.from("site_items").update({ position: nb }).eq("id", b)]);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setSitePhotoCategory(id: string, slug: string): Promise<Result> {
  try {
    const { supabase } = await requireAdminApi();
    if (!isUuid(id) || !(PHOTO_CATEGORIES as readonly string[]).includes(slug)) throw new Error("Requête invalide");
    const { error } = await supabase.from("site_items").update({ category_id: await categoryId(supabase, slug as SiteSlug) }).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ----- Matériel ----- */

/** Liste du matériel affichée à côté de la photo « Caméras et drone » (type + modèle). */
export async function saveSiteKit(items: { type: string; model: string }[]): Promise<Result> {
  try {
    const { supabase } = await requireAdminApi();
    const { error } = await supabase.from("site_settings").update({ kit: cleanKit(items), updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/site");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
