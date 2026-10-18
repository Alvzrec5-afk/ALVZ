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
  /** Planche : pictogramme affiché quand elle n'a pas encore d'images (clé de `BOARD_ICONS`). */
  icon?: string;
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

const uid = () => crypto.randomUUID();
const todo = (texts: string[]): TodoEntry[] => texts.map((text) => ({ id: uid(), text, done: false }));
const grid = (head: string[], rows: string[][], blank = 0): string[][] => [
  head,
  ...rows,
  ...Array.from({ length: blank }, () => head.map(() => "")),
];

/** Un tableau à remplir : ses cartes, et les planches (avec leur propre contenu) qu'il contient. */
export type Starter = { items: BoardItemInput[]; planches: { boardId: string; items: BoardItemInput[] }[] };

/** Fabrique de cartes avec identifiants neufs, z croissant. */
function maker() {
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
  /** Cartes rangées dans une colonne, dans l'ordre. */
  const inside = (col: BoardItemInput, cards: BoardItemInput[]) =>
    cards.map((c, i) => ({ ...c, parentId: col.id, position: i, x: col.x, y: col.y, w: col.w }));
  return { item, inside };
}

/**
 * Tout nouveau tableau : six planches prêtes, comme le déroulé d'un projet (budget → timeline du tournage),
 * chacune déjà remplie. On supprime simplement ce qui ne sert pas.
 */
export function starterKit(): Starter {
  const { item, inside } = maker();
  const planches: Starter["planches"] = [];
  const planche = (title: string, icon: string, items: BoardItemInput[]) => {
    const boardId = uid();
    planches.push({ boardId, items });
    return { title, icon, boardId };
  };

  // 1. BUDGET
  const budget = planche("1. BUDGET", "budget", [
    item("table", 40, 40, { cells: grid(["Poste", "Prévu", "Réel"], [["Équipe / assistant", "", ""], ["Location matériel", "", ""], ["Lieu", "", ""], ["Déplacements", "", ""], ["Post-production", "", ""], ["Total", "", ""]]) }, { w: 460 }),
    item("note", 540, 40, { text: "Devis\nEnvoyé le :\nAcompte reçu :\nSolde :", color: "sable" }),
  ]);

  // 2. BRIEF / APPELS CLIENT
  const brief = planche("2. BRIEF / APPELS CLIENT", "brief", [
    item("note", 40, 40, { text: "Brief\nClient :\nProjet :\nDate :\nLieu :\nLivrables :\nDurée / format :", color: "ciel" }, { w: 300 }),
    item("todo", 380, 40, { title: "Appels avec le client", items: todo(["Premier appel", "Validation du moodboard", "Validation du planning", "Appel la veille"]) }, { w: 280 }),
    item("note", 700, 40, { text: "Notes d'appel\n", color: "blanc" }, { w: 300 }),
    item("comment", 380, 280, { title: "" }, { w: 320 }),
  ]);

  // 3. MOODBOARD — trois bandeaux, inspirations musique / vidéo, cases photo, couleurs d'étalonnage.
  const musique = item("column", 40, 150, { title: "INSPI MUSIQUE" }, { w: 360 });
  const videos = item("column", 40, 430, { title: "INSPI VIDÉOS" }, { w: 360 });
  const photo = (x: number, y: number, w: number, h: number) => item("image", x, y, { caption: "", width: w, height: h }, { w });
  const mood = planche("3. MOODBOARD", "moodboard", [
    item("note", 40, 40, { text: "INSPIRATIONS", hex: "#d98b5f" }, { w: 360 }),
    item("note", 420, 40, { text: "MOODBOARD", hex: "#b4521c" }, { w: 880 }),
    item("note", 1320, 40, { text: "COULEURS/ÉTALONNAGE", hex: "#d98b5f" }, { w: 360 }),
    musique,
    ...inside(musique, [
      item("link", 0, 0, { url: "", title: "", text: "Collez un lien depuis Spotify ou SoundCloud" }),
      item("link", 0, 0, { url: "", title: "", text: "Collez un lien depuis Spotify ou SoundCloud" }),
    ]),
    videos,
    ...inside(videos, [item("table", 0, 0, { cells: grid(["Coller lien", "Coller lien", "Coller lien"], [], 1) })]),
    item("link", 40, 700, { url: "", title: "", text: "Collez un lien depuis YouTube ou Vimeo" }, { w: 360 }),
    // Cases photo vides : un clic pour y mettre une image.
    photo(420, 150, 430, 440),
    photo(420, 605, 430, 200),
    photo(420, 820, 430, 250),
    photo(870, 150, 430, 190),
    photo(870, 355, 430, 450),
    photo(870, 820, 430, 250),
    item("color", 1320, 150, { hex: "#e04a33", title: "Cinnabar" }, { w: 170 }),
    item("color", 1510, 150, { hex: "#a8521f", title: "Desert" }, { w: 170 }),
    item("color", 1320, 330, { hex: "#8b5a44", title: "Spicy Mix" }, { w: 170 }),
    item("color", 1510, 330, { hex: "#6b4e45", title: "Tobacco Brown" }, { w: 170 }),
  ]);

  // 4. SHOT LIST
  const plans = ["Plan 1 — ouverture", "Plan 2", "Plan 3 — final"].map((text, i) => item("note", 40 + i * 300, 420, { text, color: "soleil" }));
  const shot = planche("4. SHOT LIST", "shotlist", [
    item("table", 40, 40, { cells: grid(["Fait", "Plan", "Description", "Rig (Ronin, main, trépied…)", "Mouvement"], [], 6) }, { w: 860 }),
    ...plans,
    item("arrow", 0, 0, { from: plans[0].id, to: plans[1].id }),
    item("arrow", 0, 0, { from: plans[1].id, to: plans[2].id }),
  ]);

  // 5. CHECK-LIST TOURNAGE
  const check = planche("5. CHECK-LIST TOURNAGE", "checklist", [
    item("todo", 40, 40, { title: "Caméra", items: todo(["Boîtiers", "Batteries chargées", "Cartes mémoire vides", "Objectifs", "Stabilisateur / Ronin", "Trépied"]) }),
    item("todo", 330, 40, { title: "Son", items: todo(["Micro", "Enregistreur", "Bonnette", "Piles"]) }),
    item("todo", 620, 40, { title: "Lumière", items: todo(["Panneaux LED", "Pieds", "Réflecteur", "Rallonges"]) }),
    item("todo", 910, 40, { title: "La veille", items: todo(["Charger toutes les batteries", "Formater les cartes", "Vérifier la météo", "Itinéraire et horaires"]) }),
  ]);

  // 6. TIMELINE TOURNAGE
  const timeline = planche("6. TIMELINE TOURNAGE", "timeline", [
    item("table", 40, 40, { cells: grid(["Heure", "Étape", "Lieu", "Notes"], [["", "Arrivée / installation", "", ""], ["", "Préparatifs", "", ""], ["", "Plan 1", "", ""], ["", "Pause", "", ""], ["", "Plan 2", "", ""], ["", "Fin / rangement", "", ""]]) }, { w: 760 }),
  ]);

  const items = [budget, brief, mood, shot, check, timeline].map((p, i) =>
    item("board", 40 + i * 230, 40, { title: p.title, icon: p.icon, boardId: p.boardId }),
  );
  return { items, planches };
}
