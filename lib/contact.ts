/** Coordonnées du studio (carte de visite affichée dans les galeries). */
export type Contact = {
  name?: string;
  tagline?: string;
  whatsapp?: string;
  instagram?: string;
  tiktok?: string;
  email?: string;
  website?: string;
};

const clean = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function sanitizeContact(src: Record<string, unknown>): Contact {
  const handle = (v: unknown) =>
    clean(v)
      .replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com)\//i, "")
      .replace(/^@/, "")
      .replace(/[/?#].*$/, "");
  const out: Contact = {
    name: clean(src.name, 80),
    tagline: clean(src.tagline, 160),
    whatsapp: clean(src.whatsapp, 30).replace(/[^\d+]/g, ""),
    instagram: handle(src.instagram),
    tiktok: handle(src.tiktok),
    email: clean(src.email, 120),
    website: clean(src.website, 200),
  };
  for (const k of Object.keys(out) as (keyof Contact)[]) if (!out[k]) delete out[k];
  return out;
}

export function contactLinks(c: Contact) {
  const links: { key: string; label: string; href: string; value: string }[] = [];
  if (c.whatsapp) {
    const digits = c.whatsapp.replace(/\D/g, "").replace(/^0(\d{9})$/, "33$1"); // 06… → 336…
    // Affichage lisible : +33 6 11 32 94 06
    const pretty = /^33\d{9}$/.test(digits) ? `+33 ${digits.slice(2, 3)} ${digits.slice(3).replace(/(\d{2})(?=\d)/g, "$1 ")}` : c.whatsapp;
    links.push({ key: "whatsapp", label: "WhatsApp", href: `https://wa.me/${digits}`, value: pretty });
  }
  if (c.instagram) links.push({ key: "instagram", label: "Instagram", href: `https://instagram.com/${c.instagram}`, value: `@${c.instagram}` });
  if (c.tiktok) links.push({ key: "tiktok", label: "TikTok", href: `https://www.tiktok.com/@${c.tiktok}`, value: `@${c.tiktok}` });
  if (c.email) links.push({ key: "email", label: "E-mail", href: `mailto:${c.email}`, value: c.email });
  if (c.website) {
    const href = /^https?:\/\//.test(c.website) ? c.website : `https://${c.website}`;
    links.push({ key: "website", label: "Site", href, value: c.website.replace(/^https?:\/\//, "") });
  }
  return links;
}
