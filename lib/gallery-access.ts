import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { DESIGN_FIELDS, type GalleryDesign } from "@/lib/design";
import { createServiceClient } from "@/lib/supabase/server";
import { sign, unsign } from "@/lib/tokens";

export type PublicGallery = {
  id: string;
  kind: "photo" | "video";
  slug: string;
  title: string;
  event_date: string | null;
  cover_photo_id: string | null;
  password_hash: string | null;
  expires_at: string | null;
  watermark: boolean;
  downloads_enabled: boolean;
  favorites_enabled: boolean;
  download_web_enabled: boolean;
  design: Record<string, unknown> | null;
} & Omit<GalleryDesign, "nav_style" | "show_contact">;

export const GALLERY_FIELDS = `id, kind, slug, title, event_date, cover_photo_id, password_hash, expires_at, watermark, downloads_enabled, favorites_enabled, download_web_enabled, ${DESIGN_FIELDS}`;

/** Une seule lecture par requête (titre de l'onglet et page la partagent). */
export const findGalleryBySlug = cache(async (slug: string) => {
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(slug)) return null;
  const db = createServiceClient();
  const { data } = await db.from("galleries").select(GALLERY_FIELDS).eq("slug", slug).is("deleted_at", null).maybeSingle();
  return (data as PublicGallery | null) ?? null;
});

export function isExpired(g: PublicGallery) {
  return g.expires_at !== null && new Date(g.expires_at).getTime() < Date.now();
}

const accessCookie = (galleryId: string) => `g_${galleryId}`;
export const favoritesCookie = (galleryId: string) => `f_${galleryId}`;

/**
 * Le cookie d'accès est lié à l'empreinte du mot de passe : si l'admin change
 * le mot de passe, tous les accès déjà accordés deviennent invalides.
 */
function accessValue(g: PublicGallery) {
  return `${g.id}:${(g.password_hash ?? "").slice(-16)}`;
}

export async function hasAccess(g: PublicGallery) {
  if (!g.password_hash) return true;
  const store = await cookies();
  return unsign(store.get(accessCookie(g.id))?.value) === accessValue(g);
}

export async function grantAccess(g: PublicGallery) {
  const store = await cookies();
  store.set(accessCookie(g.id), sign(accessValue(g)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getFavoriteListId(g: PublicGallery) {
  const store = await cookies();
  const value = unsign(store.get(favoritesCookie(g.id))?.value);
  if (!value) return null;
  const [galleryId, listId] = value.split(":");
  return galleryId === g.id ? listId : null;
}

export async function setFavoriteListId(g: PublicGallery, listId: string) {
  const store = await cookies();
  store.set(favoritesCookie(g.id), sign(`${g.id}:${listId}`), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/**
 * Point d'entrée unique des routes API publiques : la galerie doit exister,
 * ne pas être expirée, et le visiteur doit avoir saisi le mot de passe si besoin.
 */
export async function loadAccessibleGallery(slug: string) {
  const g = await findGalleryBySlug(slug);
  if (!g) return { error: Response.json({ error: "Galerie introuvable" }, { status: 404 }) } as const;
  if (isExpired(g)) return { error: Response.json({ error: "Galerie expirée" }, { status: 410 }) } as const;
  if (!(await hasAccess(g))) {
    return { error: Response.json({ error: "Mot de passe requis" }, { status: 401 }) } as const;
  }
  return { gallery: g } as const;
}

/** E-mail du visiteur s'il s'est identifié pour ses favoris (pour le suivi des téléchargements). */
export async function visitorEmail(g: PublicGallery) {
  const listId = await getFavoriteListId(g);
  if (!listId) return null;
  const { data } = await createServiceClient().from("favorite_lists").select("email").eq("id", listId).maybeSingle();
  return (data?.email as string | undefined) ?? null;
}

/** Enregistre un téléchargement (sans jamais bloquer le téléchargement en cas d'erreur). */
export async function logDownload(
  g: PublicGallery,
  entry: { kind: "photo" | "zip"; size?: "hd" | "web"; photoId?: string; collectionId?: string | null; photoCount?: number },
) {
  try {
    await createServiceClient()
      .from("downloads")
      .insert({
        gallery_id: g.id,
        kind: entry.kind,
        size: entry.size ?? "hd",
        photo_id: entry.photoId ?? null,
        collection_id: entry.collectionId ?? null,
        photo_count: entry.photoCount ?? 1,
        email: await visitorEmail(g),
      });
  } catch (e) {
    console.error("Suivi du téléchargement impossible", e);
  }
}
