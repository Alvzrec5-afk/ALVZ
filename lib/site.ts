import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contact } from "@/lib/contact";
import { SITE_HTML } from "@/lib/site-template";
import { presignGet } from "@/lib/storage";

/**
 * Site alvzrec.com : la page d'origine (lib/site-template.ts, design inchangé) dont le contenu se gère dans le
 * studio (Studio → Site) : clips YouTube, photos par catégorie, coulisses, matériel. WhatsApp = Coordonnées.
 */

/** Catégories de photos du site (libellés traduits dans la page elle-même) et emplacements fixes. */
export const PHOTO_CATEGORIES = ["sport", "portrait", "evenement", "bapteme", "mariage"] as const;
export const SLOT_CATEGORIES = { coulisses: 3, materiel: 1 } as const;
export type SiteSlug = (typeof PHOTO_CATEGORIES)[number] | keyof typeof SLOT_CATEGORIES;

export const MAX_SITE_IMAGE_BYTES = 4 * 1024 * 1024;

export const siteItemKey = (id: string) => `site/items/${id}.jpg`;
export const siteThumbKey = (id: string) => `site/items/${id}-thumb.jpg`;

/** Numéro WhatsApp de l'ancien site, gardé si les Coordonnées n'en ont pas. */
const DEFAULT_WA = "33611329406";

/** Photos d'origine (imgur) gardées sur leur adresse ; les nouvelles sont chez Oracle (grande version + vignette). */
const imgurThumb = (url: string) => url.replace(/\.(jpe?g|png)$/i, "h.$1");

export type SitePhoto = { id: string; slug: SiteSlug; src: string; thumb: string; position: number };
export type SiteClip = { id: string; youtubeId: string; artist: string; title: string; kind: "clip" | "visualizer"; start: number };

export async function loadSiteContent(db: SupabaseClient) {
  const [{ data: cats }, { data: items }, { data: clips }] = await Promise.all([
    db.from("site_categories").select("id, slug"),
    db.from("site_items").select("id, category_id, external_url, size_bytes, thumb_size, position").order("position").order("created_at"),
    db.from("site_clips").select("id, youtube_id, artist, title, kind, start_at").order("position").order("created_at"),
  ]);
  const slugOf = new Map((cats ?? []).map((c) => [c.id as string, c.slug as SiteSlug]));
  const photos: SitePhoto[] = (
    await Promise.all(
      (items ?? []).map(async (i) => {
        const slug = slugOf.get(i.category_id as string);
        if (!slug) return null;
        const ext = i.external_url as string | null;
        if (ext) return { id: i.id as string, slug, src: ext, thumb: imgurThumb(ext), position: Number(i.position) };
        if (!(Number(i.size_bytes) > 0)) return null;
        const src = await presignGet(siteItemKey(i.id as string));
        const thumb = Number(i.thumb_size) > 0 ? await presignGet(siteThumbKey(i.id as string)) : src;
        return { id: i.id as string, slug, src, thumb, position: Number(i.position) };
      }),
    )
  ).filter((p): p is SitePhoto => p !== null);
  return {
    categories: new Map((cats ?? []).map((c) => [c.slug as SiteSlug, c.id as string])),
    photos,
    clips: (clips ?? []).map((c) => ({
      id: c.id as string,
      youtubeId: c.youtube_id as string,
      artist: c.artist as string,
      title: c.title as string,
      kind: c.kind as "clip" | "visualizer",
      start: Number(c.start_at) || 0,
    })),
  };
}

/** Contenu public du site : clips, photos (catégories), photos des emplacements fixes, numéro WhatsApp. */
export async function siteData(db: SupabaseClient) {
  const [content, { data: studio }] = await Promise.all([loadSiteContent(db), db.from("studio_settings").select("contact").eq("id", 1).maybeSingle()]);
  const contact = (studio?.contact ?? {}) as Contact;
  const slot = (slug: SiteSlug, i: number) => content.photos.filter((x) => x.slug === slug)[i]?.src;
  return {
    wa: (contact.whatsapp ?? "").replace(/\D/g, "").replace(/^0(\d{9})$/, "33$1") || DEFAULT_WA,
    clips: content.clips.map((c) => ({ id: c.youtubeId, artist: c.artist, title: c.title, kind: c.kind, start: c.start })),
    photos: content.photos.filter((p) => (PHOTO_CATEGORIES as readonly string[]).includes(p.slug)).map((p) => ({ src: p.src, thumb: p.thumb, cat: p.slug })),
    slots: { bts1: slot("coulisses", 0), bts2: slot("coulisses", 1), bts3: slot("coulisses", 2), kit: slot("materiel", 0) },
  };
}
export type SiteData = Awaited<ReturnType<typeof siteData>>;

/** Page servie par le studio (/site) : le contenu est mis directement dans la page, sans aller-retour. */
export function fillSiteHtml(data: SiteData) {
  // JSON dans un <script> : on neutralise « < » pour qu'un titre ne puisse jamais fermer la balise.
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return SITE_HTML.replace("<!--__SITE_INLINE__-->", () => `<script>window.SITE_INLINE = ${json};</script>`);
}

/** Fichier index.html à poser sur l'ancien compte Netlify : il va chercher son contenu sur alvzgalleries.com/api/site. */
export function siteFileForOldAccount() {
  return SITE_HTML.replace("<!--__SITE_INLINE__-->\n", "");
}

/** Identifiant d'une vidéo YouTube d'après un lien (youtu.be, watch?v=, shorts, embed) ou l'identifiant seul. */
export function youtubeId(input: string) {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : null;
}

/**
 * Titre et artiste d'une vidéo YouTube, lus sur la fiche publique de la vidéo (oEmbed, sans clé).
 * « Artiste - Titre (Clip officiel) » devient { artist: "Artiste", title: "Titre" } ; sinon l'artiste est la chaîne.
 */
export async function youtubeInfo(id: string) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { title?: string; author_name?: string };
    const raw = (j.title ?? "").trim();
    const visualizer = /visuali[sz]er/i.test(raw);
    const cleaned = raw
      .replace(/\s*[([](?:[^)\]]*?)(clip|official|officiel|video|vidéo|visuali[sz]er|lyrics?|audio|music)[^)\]]*[)\]]/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    const parts = cleaned.split(/\s+[-–—|]\s+/);
    const [artist, title] = parts.length >= 2 ? [parts[0], parts.slice(1).join(" - ")] : [j.author_name ?? "", cleaned];
    return { artist: artist.trim(), title: title.trim() || raw, kind: visualizer ? ("visualizer" as const) : ("clip" as const) };
  } catch {
    return null;
  }
}
