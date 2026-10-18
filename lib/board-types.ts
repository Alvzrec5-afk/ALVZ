/** Tableaux façon Milanote : types partagés entre le navigateur et le serveur. */

export type BoardKind = "note" | "image" | "todo" | "column" | "arrow" | "board" | "color" | "link" | "table" | "comment";

/** Teintes des notes : mélangées au fond, elles restent douces en mode clair comme en mode sombre. */
export const NOTE_COLORS = {
  blanc: "transparent",
  sable: "#d9b98b",
  rose: "#e3a39b",
  sauge: "#9fbf98",
  ciel: "#94b4d6",
  soleil: "#e8c95c",
} as const;
export type NoteColor = keyof typeof NOTE_COLORS;

/** Couleurs franches (bandeaux, titres de sections) : la carte prend la couleur pleine, texte lisible automatiquement. */
export const SOLID_COLORS = ["#d98b5f", "#b4521c", "#c0392b", "#d4a017", "#4f7a4a", "#2f6690", "#6a4c93", "#2b2b2b"] as const;

/** Texte blanc sur une couleur foncée, encre sur une couleur claire. */
export function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.32 ? "#1b1a19" : "#ffffff";
}

export type TodoEntry = { id: string; text: string; done: boolean };

export type BoardData = {
  text?: string;
  color?: NoteColor;
  title?: string;
  items?: TodoEntry[];
  caption?: string;
  /** Image : dimensions de la version stockée. */
  width?: number;
  height?: number;
  /** Flèche : cartes reliées. */
  from?: string;
  to?: string;
  /** Couleur : teinte libre « #rrggbb » (nom dans `title`). */
  hex?: string;
  /** Couleur du texte choisie à la main (sinon automatique : noir ou blanc selon le fond). */
  ink?: "dark" | "light";
  /** Lien : adresse (YouTube, Vimeo, Spotify, SoundCloud… ou n'importe quel site). */
  url?: string;
  /** Sous-tableau : identifiant du tableau ouvert par la carte (nom dans `title`). */
  boardId?: string;
  /** Tableau (grille) : cellules ligne par ligne ; la première ligne sert d'en-tête. */
  cells?: string[][];
};

/** Ce que le navigateur envoie pour créer ou modifier une carte. */
export type BoardItemInput = {
  id: string;
  kind: BoardKind;
  x: number;
  y: number;
  w: number;
  z: number;
  parentId: string | null;
  position: number;
  data: BoardData;
  sizeBytes?: number;
};

/** Ce que le navigateur reçoit. */
export type BoardItem = BoardItemInput & {
  author: string | null;
  /** Le visiteur actuel peut déplacer / modifier / supprimer cette carte. */
  mine: boolean;
  /** Image : URL de lecture temporaire. */
  src: string | null;
  /** Carte « commentaire » : la discussion, dans l'ordre. */
  comments?: BoardComment[];
  /** Sous-tableau : nom, nombre de cartes et quelques images pour l'aperçu. */
  sub?: { title: string; count: number; covers: string[] } | null;
};

export type BoardComment = {
  id: string;
  author: string;
  /** Écrit par le studio (logo ALVZ.REC) ou par un client (son prénom). */
  studio: boolean;
  body: string;
  at: string;
  /** Le visiteur actuel peut effacer ce message. */
  mine: boolean;
};

export type BoardOp = { op: "put"; item: BoardItemInput } | { op: "delete"; id: string };

export const DEFAULT_WIDTH: Record<BoardKind, number> = { note: 240, image: 280, todo: 260, column: 280, arrow: 0, board: 200, color: 160, link: 300, table: 420, comment: 320 };
export const TABLE_MAX_ROWS = 60;
export const TABLE_MAX_COLS = 12;

export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

export type LinkEmbed = {
  provider: "youtube" | "vimeo" | "spotify" | "soundcloud" | "deezer" | "web";
  label: string;
  /** Lecteur intégré (iframe), chargé seulement quand on appuie sur ▶. */
  embed: string | null;
  /** Hauteur du lecteur audio (les vidéos sont en 16/9). */
  height?: number;
  thumb: string | null;
  host: string;
};

/** Reconnaît les liens vidéo et musique pour afficher un lecteur dans la carte. */
export function linkEmbed(raw: string): LinkEmbed | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const yt =
    host === "youtu.be"
      ? u.pathname.slice(1)
      : /(^|\.)youtube\.com$/.test(host)
        ? u.searchParams.get("v") ?? /^\/(?:shorts|embed|live)\/([\w-]{6,})/.exec(u.pathname)?.[1] ?? null
        : null;
  if (yt && /^[\w-]{6,20}$/.test(yt)) {
    return { provider: "youtube", label: "YouTube", host, embed: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1`, thumb: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` };
  }
  const vimeo = host.endsWith("vimeo.com") ? /\/(\d{5,})/.exec(u.pathname)?.[1] : null;
  if (vimeo) return { provider: "vimeo", label: "Vimeo", host, embed: `https://player.vimeo.com/video/${vimeo}?autoplay=1`, thumb: null };
  if (host === "open.spotify.com") {
    const m = /^\/(?:intl-\w+\/)?(track|album|playlist|episode|show|artist)\/(\w+)/.exec(u.pathname);
    if (m) return { provider: "spotify", label: "Spotify", host, embed: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, height: m[1] === "track" || m[1] === "episode" ? 152 : 352, thumb: null };
  }
  if (host === "soundcloud.com") {
    return { provider: "soundcloud", label: "SoundCloud", host, embed: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.href)}&auto_play=true&visual=false`, height: 166, thumb: null };
  }
  if (host.endsWith("deezer.com")) {
    const m = /\/(track|album|playlist)\/(\d+)/.exec(u.pathname);
    if (m) return { provider: "deezer", label: "Deezer", host, embed: `https://widget.deezer.com/widget/auto/${m[1]}/${m[2]}`, height: m[1] === "track" ? 152 : 300, thumb: null };
  }
  return { provider: "web", label: host, host, embed: null, thumb: null };
}
export const MIN_WIDTH = 140;
export const MAX_WIDTH = 1200;

export const TEMPLATES = {
  vide: "Tableau vide",
  moodboard: "Moodboard shooting",
  shooting: "Préparation shooting",
  mariage: "Mariage — jour J",
  clip: "Clip / tournage",
  milanote: "Depuis Milanote",
} as const;
export type TemplateId = keyof typeof TEMPLATES;

export const TEMPLATE_HINTS: Record<TemplateId, string> = {
  vide: "Une grande page blanche.",
  moodboard: "Colonnes Ambiance, Tenues, Lieux, Poses.",
  shooting: "Matériel, liste de plans, infos pratiques, repérages.",
  mariage: "Déroulé, photos de groupe, contacts, inspirations.",
  clip: "Storyboard en 3 plans reliés, matériel, musique.",
  milanote: "Importez un tableau exporté de Milanote (texte + images).",
};

const uid = () => crypto.randomUUID();
const todo = (texts: string[]): TodoEntry[] => texts.map((text) => ({ id: uid(), text, done: false }));

/** Cartes de départ d'un modèle (nouveaux identifiants à chaque appel). */
export function templateItems(id: TemplateId): BoardItemInput[] {
  let z = 0;
  const item = (kind: BoardKind, x: number, y: number, data: BoardData, extra: Partial<BoardItemInput> = {}): BoardItemInput => ({
    id: uid(),
    kind,
    x,
    y,
    w: DEFAULT_WIDTH[kind],
    z: ++z,
    parentId: null,
    position: 0,
    data,
    ...extra,
  });

  switch (id) {
    case "moodboard": {
      const cols = ["Ambiance & lumière", "Tenues", "Lieux", "Poses"].map((title, i) => item("column", 40 + i * 320, 200, { title }));
      return [
        item("note", 40, 40, { text: "Moodboard\nAjoutez vos images d'inspiration dans chaque colonne (glissez-déposez des photos sur le tableau).", color: "sable" }, { w: 420 }),
        ...cols,
      ];
    }
    case "shooting":
      return [
        item("note", 40, 40, { text: "Infos pratiques\nLieu :\nHeure :\nContact sur place :", color: "ciel" }),
        item("todo", 320, 40, { title: "Matériel", items: todo(["Boîtiers + batteries chargées", "Cartes mémoire vides", "Objectifs", "Réflecteur / flash"]) }),
        item("todo", 620, 40, { title: "Liste de plans", items: todo(["Portrait serré", "Plan large avec le décor", "Détails"]) }),
        item("column", 920, 40, { title: "Repérages" }),
      ];
    case "mariage":
      return [
        item("todo", 40, 40, { title: "Déroulé du jour J", items: todo(["Préparatifs", "Cérémonie", "Cocktail", "Photos de groupe", "Soirée"]) }),
        item("todo", 340, 40, { title: "Photos de groupe à ne pas oublier", items: todo(["Mariés + parents", "Témoins", "Toute la famille"]) }),
        item("note", 640, 40, { text: "Contacts\nTémoins :\nWedding planner :\nLieu :", color: "rose" }),
        item("column", 920, 40, { title: "Inspirations" }),
      ];
    case "clip": {
      const plans = ["Plan 1 — ouverture", "Plan 2", "Plan 3 — final"].map((text, i) => item("note", 40 + i * 320, 60, { text, color: "soleil" }));
      return [
        ...plans,
        item("arrow", 0, 0, { from: plans[0].id, to: plans[1].id }),
        item("arrow", 0, 0, { from: plans[1].id, to: plans[2].id }),
        item("todo", 40, 300, { title: "Matériel tournage", items: todo(["Stabilisateur", "Micro", "Lumières", "Disques / cartes"]) }),
        item("note", 340, 300, { text: "Musique & références\nCollez ici les liens et les idées.", color: "sauge" }),
      ];
    }
    default:
      return [];
  }
}
