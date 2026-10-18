/** Tableaux façon Milanote : types partagés entre le navigateur et le serveur. */

export type BoardKind = "note" | "image" | "todo" | "column" | "arrow";

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
};

export type BoardOp = { op: "put"; item: BoardItemInput } | { op: "delete"; id: string };

export const DEFAULT_WIDTH: Record<BoardKind, number> = { note: 240, image: 280, todo: 260, column: 280, arrow: 0 };
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
