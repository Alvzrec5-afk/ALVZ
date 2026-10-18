/** Options de personnalisation d'une galerie (partagées entre le studio et la galerie client). */

export const COVER_LAYOUTS = {
  center: "Centré",
  bottom: "Bas gauche",
  split: "Partagé",
  framed: "Sous la photo",
  frame: "Cadre fin",
  stripe: "Lignes",
  divider: "Diptyque",
  journal: "Éditorial",
  stamp: "Vignette",
  outline: "Contour",
  classic: "Bandeau",
  none: "Sans couverture",
} as const;

export const FONT_STYLES = {
  sans: { label: "Neutre", hint: "Une police nette et neutre" },
  classic: { label: "Classique", hint: "Un serif élégant" },
  modern: { label: "Moderne", hint: "Fine et très espacée" },
  timeless: { label: "Intemporel", hint: "Légère et aérienne" },
  editorial: { label: "Éditorial", hint: "L'italique des magazines" },
  bold: { label: "Affirmé", hint: "Une police percutante" },
  minimal: { label: "Minimal", hint: "Douce et épurée" },
  subtle: { label: "Discret", hint: "Capitales fines et espacées" },
} as const;

/** Palettes : fond, fond secondaire, couleur de marque (titres). */
export const COLOR_THEMES = {
  blanc: { label: "Clair", swatch: ["#ffffff", "#f3f2f0", "#2b2b2b"] },
  or: { label: "Or", swatch: ["#fdfcf8", "#f6f2e8", "#8c7a4f"] },
  rose: { label: "Rose", swatch: ["#fbf8f7", "#f3edeb", "#8f6e70"] },
  terracotta: { label: "Terre cuite", swatch: ["#fbf8f5", "#f1ebe5", "#8e6448"] },
  sable: { label: "Sable", swatch: ["#efe8de", "#e5ddd1", "#8a7764"] },
  olive: { label: "Olive", swatch: ["#f8f8f4", "#eeeee6", "#7c8261"] },
  agave: { label: "Agave", swatch: ["#f8f9f8", "#edf1ef", "#6c8a80"] },
  mer: { label: "Mer", swatch: ["#f9f9fa", "#edeef2", "#6f7286"] },
  anthracite: { label: "Anthracite", swatch: ["#23262a", "#2c3035", "#e9e6e0"] },
  noir: { label: "Sombre", swatch: ["#0e0e0d", "#1c1c1a", "#4a4a47"] },
} as const;

export const GRID_STYLES = {
  columns: "Vertical",
  justified: "Horizontal",
  square: "Carré",
} as const;

export const GRID_SIZES = { small: "Normal", large: "Grande" } as const;
export const GRID_SPACINGS = { fine: "Normal", wide: "Large" } as const;
export const NAV_STYLES = { icons: "Icônes seules", labels: "Icônes et texte" } as const;

export type CoverLayout = keyof typeof COVER_LAYOUTS;
export type FontStyle = keyof typeof FONT_STYLES;
export type ColorTheme = keyof typeof COLOR_THEMES;
export type GridStyle = keyof typeof GRID_STYLES;
export type GridSize = keyof typeof GRID_SIZES;
export type GridSpacing = keyof typeof GRID_SPACINGS;
export type NavStyle = keyof typeof NAV_STYLES;

export type GalleryDesign = {
  cover_layout: CoverLayout;
  cover_focus_x: number;
  cover_focus_y: number;
  font_style: FontStyle;
  color_theme: ColorTheme;
  /** true : l'ambiance suit le réglage clair/sombre de l'appareil du visiteur (Clair ou Sombre). */
  color_follow_device: boolean;
  grid_style: GridStyle;
  grid_size: GridSize;
  grid_spacing: GridSpacing;
  nav_style: NavStyle;
};

export const DEFAULT_DESIGN: GalleryDesign = {
  cover_layout: "center",
  cover_focus_x: 50,
  cover_focus_y: 50,
  font_style: "classic",
  color_theme: "noir",
  color_follow_device: true,
  grid_style: "justified",
  grid_size: "large",
  grid_spacing: "fine",
  nav_style: "icons",
};

/** Colonnes à lire en base (anciennes colonnes de design + colonne JSON « design »). */
export const DESIGN_FIELDS =
  "cover_layout, cover_focus_x, cover_focus_y, font_style, color_theme, color_follow_device, grid_style, grid_size, grid_spacing, design";

const OPTIONS = {
  cover_layout: COVER_LAYOUTS,
  font_style: FONT_STYLES,
  color_theme: COLOR_THEMES,
  grid_style: GRID_STYLES,
  grid_size: GRID_SIZES,
  grid_spacing: GRID_SPACINGS,
  nav_style: NAV_STYLES,
} as const;

/** Ne garde que les réglages de design valides d'un objet quelconque. */
export function pickDesign(src: Record<string, unknown>): Partial<GalleryDesign> {
  const out: Record<string, unknown> = {};
  for (const [key, options] of Object.entries(OPTIONS)) {
    const v = src[key];
    if (typeof v === "string" && v in options) out[key] = v;
  }
  for (const key of ["cover_focus_x", "cover_focus_y"]) {
    const v = src[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = Math.min(100, Math.max(0, v));
  }
  if (typeof src.color_follow_device === "boolean") out.color_follow_device = src.color_follow_device;
  return out as Partial<GalleryDesign>;
}

/** Design complet d'une ligne de la table galleries : défauts ← anciennes colonnes ← JSON. */
export function readDesign(row: Record<string, unknown>): GalleryDesign {
  const json = row.design && typeof row.design === "object" ? (row.design as Record<string, unknown>) : {};
  return { ...DEFAULT_DESIGN, ...pickDesign(row), ...pickDesign(json) };
}

/** Valeur de data-theme à appliquer : « auto » suit l'appareil. */
export function themeAttr(d: Pick<GalleryDesign, "color_theme" | "color_follow_device">) {
  return d.color_follow_device ? "auto" : d.color_theme;
}

/** Valide une modification envoyée par le studio (hors design) : seules les clés et valeurs connues passent. */
export function sanitizeSettingsPatch(patch: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of ["watermark", "downloads_enabled", "download_web_enabled", "favorites_enabled"]) {
    if (typeof patch[key] === "boolean") out[key] = patch[key];
  }
  if (typeof patch.title === "string" && patch.title.trim()) out.title = patch.title.trim().slice(0, 200);
  if (patch.event_date === null || (typeof patch.event_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(patch.event_date))) {
    out.event_date = patch.event_date;
  }
  if (typeof patch.cover_photo_id === "string" && /^[0-9a-f-]{36}$/.test(patch.cover_photo_id)) {
    out.cover_photo_id = patch.cover_photo_id;
  }
  return out;
}
