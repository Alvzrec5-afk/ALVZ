/** Options de personnalisation d'une galerie (partagées entre le studio et la galerie client). */

export const COVER_LAYOUTS = {
  center: "Plein écran, nom centré",
  bottom: "Plein écran, nom en bas",
  split: "Moitié image, moitié texte",
  framed: "Image encadrée",
} as const;

export const FONT_STYLES = {
  classic: "Classique",
  modern: "Moderne",
  editorial: "Éditorial",
  minimal: "Minimal",
} as const;

export const COLOR_THEMES = {
  noir: { label: "Noir", bg: "#0e0e0d", ink: "#ece8e2" },
  blanc: { label: "Blanc", bg: "#fbfaf8", ink: "#161514" },
  sable: { label: "Sable", bg: "#efe8de", ink: "#2b2620" },
  anthracite: { label: "Anthracite", bg: "#23262a", ink: "#e9e6e0" },
} as const;

export const GRID_STYLES = {
  justified: "Justifiée",
  square: "Carrée",
  columns: "Colonnes",
} as const;

export const GRID_SIZES = { small: "Petites", large: "Grandes" } as const;
export const GRID_SPACINGS = { fine: "Fin", wide: "Large" } as const;

export type CoverLayout = keyof typeof COVER_LAYOUTS;
export type FontStyle = keyof typeof FONT_STYLES;
export type ColorTheme = keyof typeof COLOR_THEMES;
export type GridStyle = keyof typeof GRID_STYLES;
export type GridSize = keyof typeof GRID_SIZES;
export type GridSpacing = keyof typeof GRID_SPACINGS;

export type GalleryDesign = {
  cover_layout: CoverLayout;
  cover_focus_x: number;
  cover_focus_y: number;
  font_style: FontStyle;
  color_theme: ColorTheme;
  grid_style: GridStyle;
  grid_size: GridSize;
  grid_spacing: GridSpacing;
};

export const DESIGN_FIELDS =
  "cover_layout, cover_focus_x, cover_focus_y, font_style, color_theme, grid_style, grid_size, grid_spacing";

/** Valide une modification envoyée par le studio : seules les clés et valeurs connues passent. */
export function sanitizeSettingsPatch(patch: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const pick = <T extends object>(key: string, options: T) => {
    if (typeof patch[key] === "string" && patch[key] in options) out[key] = patch[key];
  };
  pick("cover_layout", COVER_LAYOUTS);
  pick("font_style", FONT_STYLES);
  pick("color_theme", COLOR_THEMES);
  pick("grid_style", GRID_STYLES);
  pick("grid_size", GRID_SIZES);
  pick("grid_spacing", GRID_SPACINGS);
  for (const key of ["cover_focus_x", "cover_focus_y"]) {
    const v = patch[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = Math.min(100, Math.max(0, v));
  }
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
