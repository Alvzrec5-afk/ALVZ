"use client";

import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_WIDTH,
  MAX_WIDTH,
  MIN_WIDTH,
  NOTE_COLORS,
  SOLID_COLORS,
  TABLE_MAX_COLS,
  TABLE_MAX_ROWS,
  inkOn,
  type BoardData,
  type BoardItem,
  type BoardItemInput,
  type BoardKind,
  type BoardOp,
  type NoteColor,
  linkEmbed,
} from "@/lib/board-types";
import { makeBoardImage } from "@/lib/client/image";
import { groupZipImages, isImageName, isTextName, parseMilanoteText, readZip } from "@/lib/client/milanote";
import {
  BoardIcon,
  CameraIcon,
  ChecklistIcon,
  ClockIcon,
  MoneyIcon,
  PeopleIcon,
  UploadIcon,
  FilmIcon,
  HeartIcon,
  MegaphoneIcon,
  BrushIcon,
  CloseIcon,
  ColumnIcon,
  ConnectorIcon,
  FitIcon,
  ImageIcon,
  ImportIcon,
  MinusIcon,
  LinkIcon,
  NoteIcon,
  PaletteIcon,
  PencilIcon,
  PlusIcon,
  TableIcon,
  CommentIcon,
  TrashIcon,
} from "@/components/icons";
import { BoardSync, type SyncStatus } from "./sync";

type Items = Record<string, BoardItem>;
type View = { x: number; y: number; k: number };
type Box = { x: number; y: number; w: number; h: number };
type Editing = { id: string; field?: string } | null;

type Props = {
  initialItems: BoardItem[];
  /** GET = cartes, POST = modifications. */
  endpoint: string;
  /** Studio : POST { itemId, size } → { url } d'envoi direct. Client : POST de l'image elle-même. */
  imageEndpoint: string;
  role: "admin" | "client";
  /** Le visiteur peut ajouter des cartes (toujours vrai pour le studio). */
  canAdd: boolean;
  /** Client : prénom déjà donné (sinon demandé au premier ajout). */
  visitorName?: string | null;
  joinEndpoint?: string;
  /** Ouvre la fenêtre d'import Milanote dès l'arrivée (tableau créé « Depuis Milanote »). */
  openImport?: boolean;
  /** Début de l'adresse d'un sous-tableau (carte « Tableau »), suivi de son identifiant. */
  boardBase: string;
  /** POST { itemId, body } / DELETE ?id= : messages des cartes « commentaire ». */
  commentsEndpoint: string;
  /** Client autorisé à modifier toutes les cartes (option « Le client peut tout modifier »). */
  clientEditAll?: boolean;
};

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2.5;
const POLL_MS = 30_000;
const IDLE_STOP_MS = 10 * 60_000;

const toInput = (it: BoardItem): BoardItemInput => ({
  id: it.id,
  kind: it.kind,
  x: it.x,
  y: it.y,
  w: it.w,
  z: it.z,
  parentId: it.parentId,
  position: it.position,
  data: it.data,
  ...(it.copyOf ? { copyOf: it.copyOf } : {}),
});

/** Tailles de texte proposées (multiplie la taille normale de 13 px). */
const FONT_SIZES = [
  ["Petit", 0.85],
  ["Normal", 1],
  ["Grand", 1.35],
  ["Très grand", 1.85],
  ["Titre", 2.6],
] as const;

/** Clic droit, clic à deux doigts du trackpad, ou Ctrl + clic (Mac) : ouvre le menu, ne déplace rien. */
const isContextClick = (e: { button: number; ctrlKey: boolean; pointerType?: string }) =>
  e.button === 2 || (e.button === 0 && e.ctrlKey && e.pointerType === "mouse");

/** Marque des cartes copiées (Cmd + C) dans le presse-papiers, reconnue au collage, même dans un autre tableau. */
const CLIP = "ALVZ-BOARD:";

const noteBg = (color: NoteColor | undefined, hex?: string) =>
  hex ? hex : !color || color === "blanc" ? "var(--bg)" : `color-mix(in srgb, ${NOTE_COLORS[color]} 30%, var(--bg))`;

/**
 * Couleur du texte d'une carte : choisie à la main (noir / blanc), sinon automatique sur une couleur pleine.
 * Renvoie aussi les variables qui font suivre les petits textes gris et les traits.
 */
function inkStyle(d: BoardData): React.CSSProperties | null {
  const ink = d.ink === "dark" ? "#1b1a19" : d.ink === "light" ? "#ffffff" : d.hex ? inkOn(d.hex) : null;
  if (!ink) return null;
  return {
    color: ink,
    ["--ink" as string]: ink,
    ["--muted" as string]: `color-mix(in srgb, ${ink} 62%, transparent)`,
    ["--line" as string]: `color-mix(in srgb, ${ink} 20%, transparent)`,
  } as React.CSSProperties;
}

/** Pictogrammes des planches (clé enregistrée dans `data.icon`). */
const BOARD_ICONS: Record<string, typeof BoardIcon> = {
  budget: MoneyIcon,
  brief: PeopleIcon,
  moodboard: BoardIcon,
  shotlist: ChecklistIcon,
  checklist: CameraIcon,
  timeline: ClockIcon,
  photo: ImageIcon,
  video: FilmIcon,
  notes: NoteIcon,
  palette: PaletteIcon,
  link: LinkIcon,
  comment: CommentIcon,
  heart: HeartIcon,
  megaphone: MegaphoneIcon,
  brush: BrushIcon,
  table: TableIcon,
};

/** Choix d'une couleur : teinte douce (`color`) ou couleur pleine / libre (`hex`). */
type ColorChoice = { color: NoteColor; hex?: undefined } | { color?: undefined; hex: string };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Point où la ligne qui part du centre de la carte vers (tx, ty) sort de la carte. */
function edgePoint(b: Box, tx: number, ty: number, gap: number) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  const len = Math.hypot(dx, dy) || 1;
  const s = Math.min(dx ? b.w / 2 / Math.abs(dx) : Infinity, dy ? b.h / 2 / Math.abs(dy) : Infinity, 1);
  return { x: cx + dx * s + (dx / len) * gap, y: cy + dy * s + (dy / len) * gap };
}

/** Liens cliquables dans le texte des notes. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 break-all" data-nodrag>
            {p.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

function AutoTextarea({
  value,
  onChange,
  onDone,
  onKey,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  onDone: () => void;
  onKey?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onKeyDown={(e) => {
        if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur();
        e.stopPropagation();
        onKey?.(e);
      }}
      className={`block w-full resize-none bg-transparent outline-none overflow-hidden select-text ${className}`}
    />
  );
}

function InlineInput({
  value,
  onChange,
  onDone,
  onKeyDown,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  onDone: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      autoFocus
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" || (e.key === "Enter" && !onKeyDown)) (e.target as HTMLInputElement).blur();
        onKeyDown?.(e);
      }}
      className={`w-full min-w-0 bg-transparent outline-none select-text ${className}`}
    />
  );
}

export function BoardCanvas({ initialItems, endpoint, imageEndpoint, role, canAdd, visitorName, joinEndpoint, openImport, boardBase, commentsEndpoint, clientEditAll }: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItemsState] = useState<Items>(() => Object.fromEntries(initialItems.map((i) => [i.id, i])));
  const itemsRef = useRef(items);
  const [view, setViewState] = useState<View>({ x: 60, y: 60, k: 1 });
  const viewRef = useRef(view);
  const [selected, setSelectedState] = useState<string | null>(null);
  // Sélection de plusieurs cartes (cadre tracé à la souris, ou Maj + clic).
  const [group, setGroupState] = useState<string[]>([]);
  const groupRef = useRef<string[]>([]);
  const setGroup = useCallback((ids: string[]) => {
    groupRef.current = ids;
    setGroupState(ids);
  }, []);
  const setSelected = useCallback(
    (id: string | null) => {
      setSelectedState(id);
      if (groupRef.current.length) setGroup([]);
    },
    [setGroup],
  );
  const [cropping, setCropping] = useState<string | null>(null); // image en cours de recadrage
  const [capturing, setCapturing] = useState<string | false>(false);
  const worldRef = useRef<HTMLDivElement>(null);
  // Menu du clic droit : position à l'écran (dans le tableau), point du tableau visé, carte visée.
  const [menu, setMenu] = useState<{ left: number; top: number; at: { x: number; y: number }; target: string | null } | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [groupPalette, setGroupPalette] = useState(false);
  const [toolGhost, setToolGhost] = useState<{ label: string; Icon: typeof NoteIcon; x: number; y: number } | null>(null);
  const suppressToolClick = useRef(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [arrowMode, setArrowMode] = useState<{ from: string | null } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ col: string; index: number } | null>(null);
  const [status, setStatus] = useState<SyncStatus>({ state: "saved" });
  const [name, setNameState] = useState(visitorName ?? null);
  const nameRef = useRef(name);
  const setName = (n: string) => {
    nameRef.current = n;
    setNameState(n);
  };
  const [askName, setAskName] = useState<(() => void) | null>(null);
  const [tick, setTick] = useState(0);
  const uploading = useRef(new Set<string>());
  const lastActivity = useRef(Date.now());
  const sync = useMemo(() => new BoardSync(endpoint, setStatus), [endpoint]);

  const setItems = useCallback((next: Items) => {
    itemsRef.current = next;
    setItemsState(next);
  }, []);
  const setView = useCallback((next: View) => {
    viewRef.current = next;
    setViewState(next);
  }, []);

  const canEdit = useCallback((it: BoardItem) => role === "admin" || Boolean(clientEditAll) || it.mine, [clientEditAll, role]);

  // ——— Historique (Cmd + Z / Cmd + Maj + Z) ———
  // Chaque modification enregistrée marque la carte ; après 0,6 s de calme, l'état « avant » et l'état
  // « après » de ces cartes forment une étape. Annuler remet l'état « avant » (et l'enregistre).

  type Snap = Record<string, BoardItem | null>;
  const history = useRef<{ before: Snap; after: Snap }[]>([]);
  const future = useRef<{ before: Snap; after: Snap }[]>([]);
  const committed = useRef<Items>(items); // état du tableau à la dernière étape
  const touched = useRef(new Set<string>());
  const replaying = useRef(false);
  const checkpointTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setHistoryVersion] = useState(0);

  const checkpoint = useCallback(() => {
    if (checkpointTimer.current) clearTimeout(checkpointTimer.current);
    checkpointTimer.current = null;
    const before: Snap = {};
    const after: Snap = {};
    const nextCommitted = { ...committed.current };
    for (const id of touched.current) {
      const b = committed.current[id] ?? null;
      const a = itemsRef.current[id] ?? null;
      if (a) nextCommitted[id] = a;
      else delete nextCommitted[id];
      if (JSON.stringify(b && toInput(b)) === JSON.stringify(a && toInput(a))) continue;
      before[id] = b;
      after[id] = a;
    }
    touched.current.clear();
    committed.current = nextCommitted;
    if (!Object.keys(before).length) return;
    history.current.push({ before, after });
    if (history.current.length > 100) history.current.shift();
    future.current = [];
    setHistoryVersion((v) => v + 1);
  }, []);

  /** Toute modification passe par ici : envoi au serveur + historique. */
  const push = useCallback(
    (op: BoardOp) => {
      sync.push(op);
      if (replaying.current) return;
      touched.current.add(op.op === "put" ? op.item.id : op.id);
      if (checkpointTimer.current) clearTimeout(checkpointTimer.current);
      checkpointTimer.current = setTimeout(checkpoint, 600);
    },
    [checkpoint, sync],
  );

  const replay = useCallback(
    (snap: Snap) => {
      replaying.current = true;
      const all = { ...itemsRef.current };
      const nextCommitted = { ...committed.current };
      // Colonnes d'abord, pour que leurs cartes puissent y revenir.
      const entries = Object.entries(snap).sort(([, a], [, b]) => Number(a?.kind !== "column") - Number(b?.kind !== "column"));
      for (const [id, it] of entries) {
        if (it) {
          all[id] = { ...it, src: all[id]?.src ?? it.src };
          nextCommitted[id] = all[id];
          sync.push({ op: "put", item: toInput(it) });
        } else {
          delete all[id];
          delete nextCommitted[id];
          sync.push({ op: "delete", id });
        }
      }
      committed.current = nextCommitted;
      itemsRef.current = all;
      setItemsState(all);
      replaying.current = false;
      setSelectedState(null);
      setGroup([]);
      setEditing(null);
      setHistoryVersion((v) => v + 1);
    },
    [setGroup, sync],
  );

  const undo = useCallback(() => {
    checkpoint();
    const step = history.current.pop();
    if (!step) return;
    future.current.push(step);
    replay(step.before);
  }, [checkpoint, replay]);

  const redo = useCallback(() => {
    checkpoint();
    const step = future.current.pop();
    if (!step) return;
    history.current.push(step);
    replay(step.after);
  }, [checkpoint, replay]);

  // ——— Modifications ———

  const persist = useCallback(
    (it: BoardItem) => {
      if (uploading.current.has(it.id)) return; // enregistrée à la fin de l'envoi de l'image
      push({ op: "put", item: toInput(it) });
    },
    [push],
  );

  const update = useCallback(
    (id: string, patch: Partial<BoardItem>, save = true) => {
      const it = itemsRef.current[id];
      if (!it) return;
      const next = { ...it, ...patch };
      setItems({ ...itemsRef.current, [id]: next });
      if (save) persist(next);
      lastActivity.current = Date.now();
    },
    [persist, setItems],
  );

  const updateData = useCallback(
    (id: string, patch: BoardData) => {
      const it = itemsRef.current[id];
      if (it) update(id, { data: { ...it.data, ...patch } });
    },
    [update],
  );

  const maxZ = () => Object.values(itemsRef.current).reduce((m, i) => Math.max(m, i.z), 0);

  /** Zone d'une carte en coordonnées du tableau (mesurée à l'écran). */
  const boxOf = useCallback((id: string): Box | null => {
    const root = rootRef.current;
    const el = root?.querySelector<HTMLElement>(`[data-item="${id}"]`);
    if (!root || !el) return null;
    const r = el.getBoundingClientRect();
    const o = root.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (r.left - o.left - v.x) / v.k, y: (r.top - o.top - v.y) / v.k, w: r.width / v.k, h: r.height / v.k };
  }, []);

  const remove = useCallback(
    (id: string) => {
      const all = { ...itemsRef.current };
      const it = all[id];
      if (!it || !canEdit(it)) return;
      if (it.kind === "board" && !confirm(`Supprimer le tableau « ${it.sub?.title || it.data.title || "Sans titre"} » et tout ce qu'il contient ?`)) return;
      // Une colonne supprimée libère ses cartes sur le tableau, à leur place.
      for (const child of Object.values(all).filter((c) => c.parentId === id)) {
        const b = boxOf(child.id);
        all[child.id] = { ...child, parentId: null, x: b?.x ?? it.x, y: b?.y ?? it.y, w: it.w };
        push({ op: "put", item: toInput(all[child.id]) });
      }
      const gone = [id];
      if (role === "admin") {
        for (const a of Object.values(all)) if (a.kind === "arrow" && (a.data.from === id || a.data.to === id)) gone.push(a.id);
      }
      for (const g of gone) {
        delete all[g];
        push({ op: "delete", id: g });
      }
      setItems(all);
      setSelected(null);
      setEditing(null);
    },
    [boxOf, canEdit, push, role, setItems, setSelected],
  );

  /** Supprime toutes les cartes sélectionnées (une seule confirmation). */
  const removeGroup = useCallback((ask = true) => {
    const ids = groupRef.current.filter((id) => itemsRef.current[id] && canEdit(itemsRef.current[id]));
    if (!ids.length || (ask && !confirm(`Supprimer ${ids.length} carte${ids.length > 1 ? "s" : ""} ?`))) return;
    const all = { ...itemsRef.current };
    const gone = new Set(ids);
    for (const id of ids) {
      for (const child of Object.values(all).filter((c) => c.parentId === id && !gone.has(c.id))) {
        const b = boxOf(child.id);
        all[child.id] = { ...child, parentId: null, x: b?.x ?? all[id].x, y: b?.y ?? all[id].y };
        push({ op: "put", item: toInput(all[child.id]) });
      }
    }
    if (role === "admin") for (const a of Object.values(all)) if (a.kind === "arrow" && (gone.has(a.data.from ?? "") || gone.has(a.data.to ?? ""))) gone.add(a.id);
    for (const g of gone) {
      delete all[g];
      push({ op: "delete", id: g });
    }
    setItems(all);
    setGroup([]);
    setSelected(null);
  }, [boxOf, canEdit, push, role, setGroup, setItems, setSelected]);

  /** Couleur appliquée à une carte ou à toute la sélection (notes et colonnes). */
  const applyColor = useCallback(
    (ids: string[], c: ColorChoice) => {
      for (const id of ids) {
        const it = itemsRef.current[id];
        if (!it || it.kind === "arrow" || !canEdit(it)) continue;
        // Carte « couleur » : la palette change la teinte affichée ; les autres : le fond de la carte.
        if (it.kind === "color") {
          if (c.hex) update(id, { data: { ...it.data, hex: c.hex } });
        } else update(id, { data: { ...it.data, color: c.color ?? it.data.color ?? "blanc", hex: c.hex } });
      }
    },
    [canEdit, update],
  );

  /** Couleur du texte choisie à la main (« auto » = noir ou blanc selon le fond). */
  const applyInk = useCallback(
    (ids: string[], ink: "auto" | "dark" | "light") => {
      for (const id of ids) {
        const it = itemsRef.current[id];
        if (!it || it.kind === "arrow" || it.kind === "color" || !canEdit(it)) continue;
        update(id, { data: { ...it.data, ink: ink === "auto" ? undefined : ink } });
      }
    },
    [canEdit, update],
  );

  /** Entrer dans un sous-tableau (les modifications en attente partent avant). */
  const openBoard = useCallback(
    (it: BoardItem) => {
      if (!it.data.boardId) return;
      void sync.flush(true);
      router.push(`${boardBase}${it.data.boardId}`);
    },
    [boardBase, router, sync],
  );

  // ——— Copier / coller (Cmd + C, Cmd + X, Cmd + V) ———

  const clipboard = useRef<string | null>(null); // secours si le presse-papiers est refusé
  const copyPending = useRef(0); // moment du dernier Cmd + C / X sur des cartes

  /** Sélection prête à coller : cartes, contenu de leurs colonnes, et flèches entre elles. */
  const serializeSelection = useCallback(() => {
    const roots = (groupRef.current.length ? groupRef.current : selected ? [selected] : []).filter((id) => itemsRef.current[id]);
    if (!roots.length) return "";
    const all = itemsRef.current;
    const ids = new Set(roots.filter((id) => all[id].kind !== "arrow"));
    for (const it of Object.values(all)) if (it.parentId && ids.has(it.parentId)) ids.add(it.id);
    for (const it of Object.values(all)) {
      if (it.kind === "arrow" && it.data.from && it.data.to && ids.has(it.data.from) && ids.has(it.data.to)) ids.add(it.id);
    }
    if (!ids.size) return "";
    return CLIP + JSON.stringify({ v: 1, from: endpoint, items: [...ids].map((id) => ({ ...all[id], comments: undefined })) });
  }, [endpoint, selected]);

  /** Copie la sélection dans le presse-papiers (et pour les autres onglets). */
  const copySelection = useCallback(() => {
    const payload = serializeSelection();
    if (!payload) return false;
    clipboard.current = payload;
    // Aussi pour les autres onglets du même navigateur (si le presse-papiers est refusé).
    try {
      localStorage.setItem("alvz-board-clip", payload);
    } catch {}
    navigator.clipboard?.writeText(payload).catch(() => undefined);
    return true;
  }, [serializeSelection]);

  /** Colle des cartes copiées : nouveaux identifiants, colonnes et flèches reliées, images et planches dupliquées. */
  const pasteCards = useCallback(
    (raw: string, at?: { x: number; y: number }) => {
      let parsed: { from?: string; items?: BoardItem[] };
      try {
        parsed = JSON.parse(raw.slice(CLIP.length));
      } catch {
        return;
      }
      // Un client ne colle ni images ni planches (elles appartiennent au studio).
      const source = (parsed.items ?? []).filter((it) => role === "admin" || (it.kind !== "image" && it.kind !== "board"));
      if (!source.length) return;
      const idMap = new Map(source.map((it) => [it.id, crypto.randomUUID()]));
      const tops = source.filter((it) => !it.parentId || !idMap.has(it.parentId)).filter((it) => it.kind !== "arrow");
      // Même tableau : juste à côté de l'original. Autre tableau : au centre de l'écran.
      let dx = 40;
      let dy = 40;
      if (at && tops.length) {
        // Clic droit → « Coller ici » : le coin haut-gauche des cartes arrive sous la souris.
        dx = Math.round(at.x - Math.min(...tops.map((t) => t.x)));
        dy = Math.round(at.y - Math.min(...tops.map((t) => t.y)));
      } else if (parsed.from !== endpoint && tops.length) {
        const c = viewCenter();
        dx = Math.round(c.x - Math.min(...tops.map((t) => t.x)) - 120);
        dy = Math.round(c.y - Math.min(...tops.map((t) => t.y)) - 80);
      }
      let z = maxZ();
      const all = { ...itemsRef.current };
      const created: BoardItem[] = [];
      for (const it of source) {
        const id = idMap.get(it.id)!;
        const inParent = it.parentId && idMap.has(it.parentId);
        const data = { ...it.data };
        if (it.kind === "arrow") {
          data.from = data.from ? idMap.get(data.from) : undefined;
          data.to = data.to ? idMap.get(data.to) : undefined;
        }
        if (it.kind === "board") data.boardId = crypto.randomUUID();
        const copy: BoardItem = {
          ...it,
          id,
          x: inParent ? it.x : it.x + dx,
          y: inParent ? it.y : it.y + dy,
          z: ++z,
          parentId: inParent ? idMap.get(it.parentId!)! : null,
          data,
          author: role === "client" ? nameRef.current : it.author,
          mine: true,
          comments: it.kind === "comment" ? [] : undefined,
          copyOf: it.kind === "image" || it.kind === "board" ? it.id : undefined,
        };
        all[id] = copy;
        created.push(copy);
      }
      setItems(all);
      for (const c of [...created].sort((a, b) => Number(a.kind !== "column") - Number(b.kind !== "column"))) push({ op: "put", item: toInput(c) });
      setSelectedState(null);
      setGroup(created.filter((c) => c.kind !== "arrow" && !c.parentId).map((c) => c.id));
      lastActivity.current = Date.now();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endpoint, push, role, setGroup, setItems],
  );

  // ——— Ajout de cartes ———

  const ensureName = useCallback(
    (action: () => void) => {
      if (role === "admin" || nameRef.current) action();
      else setAskName(() => action);
    },
    [role],
  );

  const viewCenter = () => {
    const r = rootRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (r.width / 2 - v.x) / v.k, y: (r.height / 2 - v.y) / v.k };
  };

  const create = useCallback(
    (kind: BoardKind, data: BoardData, at?: { x: number; y: number }, extra: Partial<BoardItem> = {}) => {
      const c = at ?? viewCenter();
      const w = DEFAULT_WIDTH[kind];
      const jitter = at ? 0 : (Math.random() - 0.5) * 40;
      const it: BoardItem = {
        id: crypto.randomUUID(),
        kind,
        x: Math.round(c.x - (at ? 0 : w / 2) + jitter),
        y: Math.round(c.y - (at ? 0 : 60) + jitter),
        w,
        z: maxZ() + 1,
        parentId: null,
        position: 0,
        data,
        author: role === "client" ? nameRef.current : null,
        mine: true,
        src: null,
        ...extra,
      };
      setItems({ ...itemsRef.current, [it.id]: it });
      persist(it);
      setSelected(it.id);
      lastActivity.current = Date.now();
      return it;
    },
    [persist, role, setItems, setSelected],
  );

  type At = { x: number; y: number };
  type Extra = Partial<BoardItem>;
  const addNote = (at?: At, extra?: Extra) =>
    ensureName(() => {
      const it = create("note", { text: "", color: "blanc" }, at, extra);
      setEditing({ id: it.id });
    });
  const addTodo = (at?: At, extra?: Extra) =>
    ensureName(() => {
      const it = create("todo", { title: "", items: [{ id: crypto.randomUUID(), text: "", done: false }] }, at, extra);
      setEditing({ id: it.id, field: "title" });
    });
  const addLink = (url = "", at?: At, extra?: Extra) =>
    ensureName(() => {
      const it = create("link", { url, title: "" }, at, extra);
      if (!url) setEditing({ id: it.id });
    });
  const addColor = (at?: At, extra?: Extra) => {
    const it = create("color", { hex: "#c8a27a", title: "" }, at, extra);
    setEditing({ id: it.id, field: "title" });
  };
  const addBoard = (at?: At, extra?: Extra) => {
    const it = create("board", { title: "", boardId: crypto.randomUUID() }, at, { sub: { title: "", count: 0, covers: [] }, ...extra });
    setEditing({ id: it.id, field: "title" });
  };
  const addColumn = (at?: At) => {
    const it = create("column", { title: "", color: "blanc" }, at);
    setEditing({ id: it.id, field: "title" });
  };
  const addTable = (at?: At, extra?: Extra) =>
    ensureName(() => {
      const it = create("table", { cells: Array.from({ length: 3 }, () => ["", "", ""]) }, at, extra);
      setEditing({ id: it.id, field: "c:0:0" });
    });
  const addComment = (at?: At, extra?: Extra) =>
    ensureName(() => {
      const it = create("comment", {}, at, { comments: [], ...extra });
      setEditing({ id: it.id, field: "reply" });
    });

  /** Envoie un message (affiché tout de suite, confirmé ensuite par le serveur). */
  const sendComment = (it: BoardItem) =>
    ensureName(async () => {
      const body = (replies[it.id] ?? "").trim();
      if (!body) return;
      const temp = { id: `tmp-${Date.now()}`, author: role === "admin" ? "ALVZ.REC" : nameRef.current ?? "", studio: role === "admin", body, at: new Date().toISOString(), mine: true };
      const withMsg = (list: BoardItem["comments"], m: typeof temp) => [...(list ?? []), m];
      update(it.id, { comments: withMsg(itemsRef.current[it.id]?.comments, temp) }, false);
      setReplies((r) => ({ ...r, [it.id]: "" }));
      const post = () =>
        fetch(commentsEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: it.id, body }) });
      try {
        // La carte vient peut-être d'être créée : elle doit d'abord être enregistrée.
        await sync.flush();
        let res = await post();
        if (res.status === 400) {
          await new Promise((r) => setTimeout(r, 1200));
          await sync.flush();
          res = await post();
        }
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
        const cur = itemsRef.current[it.id];
        if (cur) update(it.id, { comments: (cur.comments ?? []).map((m) => (m.id === temp.id ? { ...m, id: json.id, at: json.at } : m)) }, false);
      } catch (e) {
        const cur = itemsRef.current[it.id];
        if (cur) update(it.id, { comments: (cur.comments ?? []).filter((m) => m.id !== temp.id) }, false);
        setReplies((r) => ({ ...r, [it.id]: body }));
        alert(`Message non envoyé : ${e instanceof Error ? e.message : e}`);
      }
    });

  const deleteComment = async (it: BoardItem, id: string) => {
    if (!confirm("Effacer ce message ?")) return;
    const before = it.comments ?? [];
    update(it.id, { comments: before.filter((m) => m.id !== id) }, false);
    const res = await fetch(`${commentsEndpoint}${commentsEndpoint.includes("?") ? "&" : "?"}id=${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      update(it.id, { comments: before }, false);
      alert("Message non effacé, réessayez.");
    }
  };

  const imageDrop = useRef<{ at: At; extra?: Extra } | null>(null);

  /**
   * Prépare et envoie des images, une par une. `place` décide où va chaque image (ex. dans une colonne,
   * lors d'un import) ; sans lui, elles s'empilent légèrement décalées. Renvoie les échecs au lieu d'alerter.
   */
  const uploadImages = useCallback(
    async (
      files: File[],
      at?: { x: number; y: number },
      place?: (i: number, size: { width: number; height: number }) => Partial<BoardItem>,
      onProgress?: (done: number) => void,
    ) => {
      const images = files.filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|avif|gif)$/i.test(f.name));
      const failed: string[] = [];
      for (const [i, file] of images.entries()) {
        onProgress?.(i);
        const pos = at ? { x: at.x + i * 30, y: at.y + i * 30 } : undefined;
        let prepared: Awaited<ReturnType<typeof makeBoardImage>>;
        try {
          prepared = await makeBoardImage(file);
        } catch (e) {
          failed.push(`${file.name} : ${e instanceof Error ? e.message : e}`);
          continue;
        }
        const id = crypto.randomUUID();
        uploading.current.add(id);
        const it = create("image", { caption: "", width: prepared.width, height: prepared.height }, pos, {
          id,
          src: URL.createObjectURL(prepared.blob),
          ...place?.(i, prepared),
        });
        try {
          if (role === "client") {
            // Client : le serveur vérifie l'image et crée la carte.
            const res = await fetch(imageEndpoint, {
              method: "POST",
              headers: { "Content-Type": "image/jpeg", "x-board-item": JSON.stringify(toInput(itemsRef.current[id] ?? it)) },
              body: prepared.blob,
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
          } else {
            // Studio : envoi direct vers Oracle.
            const res = await fetch(imageEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ itemId: it.id, size: prepared.blob.size }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
            const put = await fetch(json.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: prepared.blob });
            if (!put.ok) throw new Error(`Envoi refusé (${put.status})`);
          }
          uploading.current.delete(id);
          const latest = itemsRef.current[id];
          if (latest) push({ op: "put", item: { ...toInput(latest), sizeBytes: prepared.blob.size } });
        } catch (e) {
          uploading.current.delete(id);
          const all = { ...itemsRef.current };
          delete all[id];
          setItems(all);
          failed.push(`${file.name} : ${e instanceof Error ? e.message : e}`);
        }
      }
      onProgress?.(images.length);
      return failed;
    },
    [create, imageEndpoint, push, role, setItems],
  );

  /** Met une image dans une case photo vide (la carte garde sa place et sa largeur). */
  const fillTarget = useRef<string | null>(null);
  const fillImage = useCallback(
    async (id: string, file: File) => {
      const it = itemsRef.current[id];
      if (!it) return;
      let prepared: Awaited<ReturnType<typeof makeBoardImage>>;
      try {
        prepared = await makeBoardImage(file);
      } catch (e) {
        alert(`${file.name} : ${e instanceof Error ? e.message : e}`);
        return;
      }
      uploading.current.add(id);
      update(id, { src: URL.createObjectURL(prepared.blob), data: { ...it.data, width: prepared.width, height: prepared.height } }, false);
      try {
        const res = await fetch(imageEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: id, size: prepared.blob.size }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
        const put = await fetch(json.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: prepared.blob });
        if (!put.ok) throw new Error(`Envoi refusé (${put.status})`);
        uploading.current.delete(id);
        const latest = itemsRef.current[id];
        if (latest) push({ op: "put", item: { ...toInput(latest), sizeBytes: prepared.blob.size } });
      } catch (e) {
        uploading.current.delete(id);
        update(id, { src: null, data: it.data }, false);
        alert(`Image non envoyée : ${e instanceof Error ? e.message : e}`);
      }
    },
    [imageEndpoint, push, update],
  );

  const addImages = useCallback(
    (files: File[], at?: { x: number; y: number }) =>
      ensureName(async () => {
        const failed = await uploadImages(files, at);
        if (failed.length) alert(`Image${failed.length > 1 ? "s" : ""} non envoyée${failed.length > 1 ? "s" : ""} :\n${failed.join("\n")}`);
      }),
    [ensureName, uploadImages],
  );

  // ——— Import Milanote (studio) ———

  const [importing, setImporting] = useState<string | null>(null);
  const fitRef = useRef<() => void>(() => {}); // « Tout voir », défini plus bas
  const [importOpen, setImportOpen] = useState(Boolean(openImport) && role === "admin");

  /** Exports Milanote (Markdown / texte, ZIP d'images, images seules) → cartes, à droite du contenu existant. */
  const importMilanote = useCallback(
    async (files: File[]) => {
      setImportOpen(false);
      setImporting("Lecture des fichiers…");
      try {
        const texts: File[] = [];
        const imageGroups: { title: string | null; files: File[] }[] = [];
        let other = 0;
        for (const f of files) {
          if (/\.zip$/i.test(f.name)) {
            const entries = await readZip(f);
            texts.push(...entries.filter((e) => isTextName(e.path)).map((e) => e.file));
            imageGroups.push(...groupZipImages(entries));
            other += entries.filter((e) => !isTextName(e.path) && !isImageName(e.path)).length;
          } else if (isTextName(f.name) || f.type.startsWith("text/")) texts.push(f);
          else if (isImageName(f.name) || f.type.startsWith("image/")) imageGroups.push({ title: null, files: [f] });
          else other++;
        }
        const looseImages = imageGroups.filter((g) => !g.title).flatMap((g) => g.files);
        const folders = imageGroups.filter((g) => g.title);

        // Point de départ : à droite de ce qui existe déjà.
        const boxes = Object.values(itemsRef.current)
          .filter((i) => i.kind !== "arrow" && !i.parentId)
          .map((i) => boxOf(i.id))
          .filter((b): b is Box => Boolean(b));
        const ox = boxes.length ? Math.max(...boxes.map((b) => b.x + b.w)) + 160 : 0;
        const oy = boxes.length ? Math.min(...boxes.map((b) => b.y)) : 0;
        let col = 0; // colonnes posées de gauche à droite
        let z = maxZ();
        const created: BoardItem[] = [];
        const base = { author: null, mine: true, src: null, parentId: null, position: 0 } as const;
        const column = (title: string) => {
          const c: BoardItem = { ...base, id: crypto.randomUUID(), kind: "column", x: ox + col++ * 320, y: oy, w: 280, z: ++z, data: { title, color: "blanc" } };
          created.push(c);
          return c;
        };

        let skippedImages = 0;
        for (const t of texts) {
          const parsed = parseMilanoteText(await t.text());
          skippedImages += parsed.skippedImages;
          for (const g of parsed.groups) {
            const parent = column(g.title ?? (texts.length > 1 ? t.name.replace(/\.\w+$/, "") : "Notes"));
            g.cards.forEach((card, i) =>
              created.push({
                ...base,
                id: crypto.randomUUID(),
                kind: card.kind,
                x: parent.x,
                y: parent.y,
                w: 280,
                z: ++z,
                parentId: parent.id,
                position: i,
                data:
                  card.kind === "note"
                    ? { text: card.text, color: "blanc" }
                    : card.kind === "link"
                      ? { url: card.url, title: card.title }
                      : card.kind === "table"
                        ? { cells: card.cells }
                        : { title: card.title, items: card.items },
              }),
            );
          }
        }
        // Un dossier d'images qui porte le nom d'une colonne du texte va dans cette colonne.
        const byTitle = new Map(created.filter((c) => c.kind === "column").map((c) => [String(c.data.title).toLowerCase(), c]));
        const count = (id: string) => created.filter((c) => c.parentId === id).length;
        const folderColumns = folders.map((f) => {
          const existing = byTitle.get(f.title!.toLowerCase());
          return { col: existing ?? column(f.title!), files: f.files, start: existing ? count(existing.id) : 0 };
        });
        const looseColumn = looseImages.length ? column(folders.length || texts.length ? "Images" : "Images importées") : null;

        if (created.length) {
          const all = { ...itemsRef.current };
          for (const it of created) all[it.id] = it;
          setItems(all);
          // Colonnes d'abord, pour que leurs cartes puissent y être rangées.
          for (const it of [...created].sort((a, b) => Number(a.kind !== "column") - Number(b.kind !== "column"))) persist(it);
        }
        requestAnimationFrame(() => fitRef.current());

        const total = folderColumns.reduce((n, f) => n + f.files.length, 0) + looseImages.length;
        let sent = 0;
        const failed: string[] = [];
        for (const { col: c, files: list, start } of [...folderColumns, ...(looseColumn ? [{ col: looseColumn, files: looseImages, start: 0 }] : [])]) {
          failed.push(
            ...(await uploadImages(list, undefined, (i) => ({ parentId: c.id, position: start + i, x: c.x, y: c.y, w: 280 }), (d) =>
              setImporting(`Envoi des images… ${Math.min(total, sent + d)} / ${total}`),
            )),
          );
          sent += list.length;
        }
        setSelected(null);
        requestAnimationFrame(() => fitRef.current());

        const notes: string[] = [];
        if (skippedImages && !total) notes.push(`${skippedImages} image(s) citée(s) dans le texte : importez aussi le ZIP (Export → Generate ZIP) pour les récupérer.`);
        if (other) notes.push(`${other} fichier(s) ignoré(s) (PDF, vidéos, documents…).`);
        if (failed.length) notes.push(`Images non envoyées :\n${failed.slice(0, 10).join("\n")}`);
        if (!created.length && !total) notes.unshift("Rien à importer dans ces fichiers.");
        if (notes.length) alert(notes.join("\n\n"));
      } catch (e) {
        alert(`Import impossible : ${e instanceof Error ? e.message : e}`);
      } finally {
        setImporting(null);
      }
    },
    [boxOf, fitRef, persist, setItems, uploadImages],
  );

  // ——— Rangement, ordre d'affichage ———

  const childrenOf = useCallback(
    (colId: string) =>
      Object.values(items)
        .filter((i) => i.parentId === colId && i.id !== dragId)
        .sort((a, b) => a.position - b.position),
    [items, dragId],
  );
  const topLevel = useMemo(
    () => Object.values(items).filter((i) => i.kind !== "arrow" && (!i.parentId || !items[i.parentId] || i.id === dragId)),
    [items, dragId],
  );
  const zRank = useMemo(() => {
    const sorted = [...topLevel].sort((a, b) => a.z - b.z);
    return new Map(sorted.map((i, n) => [i.id, n + 1]));
  }, [topLevel]);
  const arrows = useMemo(() => Object.values(items).filter((i) => i.kind === "arrow"), [items]);

  // ——— Déplacement des cartes ———

  const startDrag = (e: React.PointerEvent, it: BoardItem) => {
    if (e.button !== 0 || isContextClick(e)) return;
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, button, a, [data-nodrag]")) return;
    if (arrowMode) {
      e.stopPropagation();
      if (it.kind === "arrow") return;
      if (!arrowMode.from) setArrowMode({ from: it.id });
      else if (arrowMode.from !== it.id) {
        create("arrow", { from: arrowMode.from, to: it.id }, { x: 0, y: 0 });
        setArrowMode(null);
      }
      return;
    }
    // Au doigt (téléphone, tablette) : glisser fait défiler le tableau, même sur une carte.
    // Un toucher sélectionne la carte ; une fois sélectionnée, on peut la faire glisser.
    if (e.pointerType !== "mouse" && selected !== it.id && !groupRef.current.includes(it.id)) {
      const sx = e.clientX;
      const sy = e.clientY;
      const pid = e.pointerId;
      const tap = (ev: PointerEvent) => {
        if (ev.pointerId !== pid) return;
        window.removeEventListener("pointerup", tap);
        window.removeEventListener("pointercancel", cancel);
        // Le fond a déjà désélectionné et fait défiler ; un simple toucher sélectionne la carte.
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8 && pointers.current.size <= 1) setSelected(it.id);
      };
      const cancel = () => {
        window.removeEventListener("pointerup", tap);
        window.removeEventListener("pointercancel", cancel);
      };
      window.addEventListener("pointerup", tap);
      window.addEventListener("pointercancel", cancel);
      return; // l'évènement continue jusqu'au fond, qui fait défiler / zoomer
    }
    if (!canEdit(it)) return; // carte du studio côté client : le geste déplace le tableau
    e.stopPropagation();
    if (editing?.id !== it.id) setEditing(null);
    // Maj + clic : ajoute ou retire la carte de la sélection.
    if (e.shiftKey && !it.parentId) {
      const cur = groupRef.current.length ? groupRef.current : selected && selected !== it.id && !itemsRef.current[selected]?.parentId ? [selected] : [];
      const next = cur.includes(it.id) ? cur.filter((x) => x !== it.id) : [...cur, it.id];
      setSelectedState(null);
      setGroup(next);
      return;
    }
    if (groupRef.current.length > 1 && groupRef.current.includes(it.id)) {
      startGroupDrag(e);
      return;
    }
    setSelected(it.id);
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    let origin = { x: it.x, y: it.y };
    const v = viewRef.current;

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / v.k;
      const dy = (ev.clientY - startY) / v.k;
      if (!moved) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
        moved = true;
        // Sortie d'une colonne : la carte reprend sa place exacte à l'écran.
        const b = it.parentId ? boxOf(it.id) : null;
        if (b) origin = { x: b.x, y: b.y };
        update(it.id, { parentId: null, x: origin.x, y: origin.y, w: b ? b.w : it.w, z: maxZ() + 1 }, false);
        setDragId(it.id);
      }
      update(it.id, { x: Math.round(origin.x + dx), y: Math.round(origin.y + dy) }, false);
      setDropTarget(it.kind === "column" ? null : findDrop(ev.clientX, ev.clientY, it.id));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (!moved) return;
      const drop = it.kind === "column" ? null : findDrop(ev.clientX, ev.clientY, it.id);
      const cur = itemsRef.current[it.id];
      if (drop) {
        const siblings = Object.values(itemsRef.current)
          .filter((c) => c.parentId === drop.col && c.id !== it.id)
          .sort((a, b) => a.position - b.position);
        const before = siblings[drop.index - 1];
        const after = siblings[drop.index];
        const position = before && after ? (before.position + after.position) / 2 : before ? before.position + 1 : after ? after.position - 1 : 0;
        update(it.id, { parentId: drop.col, position, w: cur.w });
      } else if (cur) {
        persist(cur);
      }
      setDragId(null);
      setDropTarget(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  /** Déplace toutes les cartes sélectionnées ensemble. */
  const startGroupDrag = (e: React.PointerEvent) => {
    const ids = groupRef.current.filter((id) => itemsRef.current[id] && !itemsRef.current[id].parentId);
    const origins = new Map(ids.map((id) => [id, { x: itemsRef.current[id].x, y: itemsRef.current[id].y }]));
    const startX = e.clientX;
    const startY = e.clientY;
    const k = viewRef.current.k;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
      moved = true;
      const dx = (ev.clientX - startX) / k;
      const dy = (ev.clientY - startY) / k;
      const all = { ...itemsRef.current };
      for (const [id, o] of origins) if (all[id]) all[id] = { ...all[id], x: Math.round(o.x + dx), y: Math.round(o.y + dy) };
      setItems(all);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (moved) for (const id of ids) if (itemsRef.current[id]) persist(itemsRef.current[id]);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  /** Colonne sous le pointeur et rang d'insertion. */
  function findDrop(clientX: number, clientY: number, selfId: string) {
    const root = rootRef.current;
    if (!root) return null;
    for (const col of Object.values(itemsRef.current)) {
      if (col.kind !== "column" || col.id === selfId) continue;
      const el = root.querySelector<HTMLElement>(`[data-item="${col.id}"]`);
      const r = el?.getBoundingClientRect();
      if (!r || clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) continue;
      const kids = [...root.querySelectorAll<HTMLElement>(`[data-child-of="${col.id}"]`)].filter((k) => k.dataset.item !== selfId);
      const index = kids.findIndex((k) => {
        const kr = k.getBoundingClientRect();
        return clientY < kr.top + kr.height / 2;
      });
      return { col: col.id, index: index === -1 ? kids.length : index };
    }
    return null;
  }

  const startResize = (e: React.PointerEvent, it: BoardItem) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startW = it.w;
    const k = viewRef.current.k;
    const move = (ev: PointerEvent) => update(it.id, { w: Math.round(clamp(startW + (ev.clientX - startX) / k, MIN_WIDTH, MAX_WIDTH)) }, false);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const cur = itemsRef.current[it.id];
      if (cur) persist(cur);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ——— Déplacement et zoom du tableau ———

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const v = viewRef.current;
      const k = clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM);
      const f = k / v.k;
      setView({ k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f });
    },
    [setView],
  );

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const spaceDown = useRef(false);
  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  const onBackgroundDown = (e: React.PointerEvent) => {
    if (isContextClick(e)) return; // clic droit / deux doigts / Ctrl + clic : menu (onContextMenu)
    const t = e.target as HTMLElement;
    if (t.closest("[data-ui]")) return;
    // Au doigt, glisser sur une case de tableau, une case à cocher ou un lien fait aussi défiler le tableau
    // (un simple toucher garde son effet : ouvrir la case, cocher…). Seul le champ en cours d'écriture reste à lui.
    const field = t.closest("input, textarea");
    if (t.closest("input, textarea, button, a, [data-nodrag]") && (e.pointerType === "mouse" || (field && field === document.activeElement))) return;
    setMenu(null);
    lastActivity.current = Date.now();
    if (arrowMode && e.pointerType === "mouse") setArrowMode(null);
    setSelected(null);
    setEditing(null);
    const root = rootRef.current!;
    const o = root.getBoundingClientRect();
    // Souris : glisser sur le fond trace un cadre de sélection (comme Milanote).
    // Le tableau se déplace avec la molette / le pavé tactile, ou espace + glisser, ou le bouton du milieu.
    if (e.pointerType === "mouse" && e.button === 0 && !spaceDown.current && !arrowMode) {
      const x0 = e.clientX - o.left;
      const y0 = e.clientY - o.top;
      const additive = e.shiftKey ? [...groupRef.current] : [];
      const move = (ev: PointerEvent) => {
        const m = { x0, y0, x1: ev.clientX - o.left, y1: ev.clientY - o.top };
        setMarquee(m);
        const v = viewRef.current;
        const wx0 = (Math.min(m.x0, m.x1) - v.x) / v.k;
        const wx1 = (Math.max(m.x0, m.x1) - v.x) / v.k;
        const wy0 = (Math.min(m.y0, m.y1) - v.y) / v.k;
        const wy1 = (Math.max(m.y0, m.y1) - v.y) / v.k;
        const hit = Object.values(itemsRef.current)
          .filter((i) => i.kind !== "arrow" && !i.parentId && canEdit(i))
          .filter((i) => {
            const b = boxOf(i.id);
            return b && b.x < wx1 && b.x + b.w > wx0 && b.y < wy1 && b.y + b.h > wy0;
          })
          .map((i) => i.id);
        setGroup([...new Set([...additive, ...hit])]);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        setMarquee(null);
        if (groupRef.current.length === 1) {
          const only = groupRef.current[0];
          setGroup([]);
          setSelectedState(only);
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      return;
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2 - o.left, cy: (a.y + b.y) / 2 - o.top };
    }
    let last = { x: e.clientX, y: e.clientY };
    const id = e.pointerId;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id && !pointers.current.has(ev.pointerId)) return;
      pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pointers.current.size >= 2 && pinch.current) {
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2 - o.left;
        const cy = (a.y + b.y) / 2 - o.top;
        const v = viewRef.current;
        const k = clamp((v.k * dist) / pinch.current.dist, MIN_ZOOM, MAX_ZOOM);
        const f = k / v.k;
        setView({ k, x: cx - (pinch.current.cx - v.x) * f, y: cy - (pinch.current.cy - v.y) * f });
        pinch.current = { dist, cx, cy };
        return;
      }
      if (ev.pointerId !== id) return;
      const v = viewRef.current;
      setView({ ...v, x: v.x + ev.clientX - last.x, y: v.y + ev.clientY - last.y });
      last = { x: ev.clientX, y: ev.clientY };
    };
    const up = (ev: PointerEvent) => {
      pointers.current.delete(ev.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      if (ev.pointerId !== id) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // Molette : défilement ; Ctrl/Cmd + molette ou pincement du pavé tactile : zoom.
  useEffect(() => {
    const root = rootRef.current!;
    const wheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("textarea")) return;
      e.preventDefault();
      const o = root.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(clamp(-e.deltaY, -60, 60) * 0.006), e.clientX - o.left, e.clientY - o.top);
      else {
        const v = viewRef.current;
        setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
      }
    };
    // Safari (Mac) : pincement du pavé tactile.
    let gestureScale = 1;
    const gstart = (e: Event) => {
      e.preventDefault();
      gestureScale = 1;
    };
    const gchange = (e: Event) => {
      e.preventDefault();
      const g = e as Event & { scale: number; clientX: number; clientY: number };
      const o = root.getBoundingClientRect();
      zoomAt(g.scale / gestureScale, g.clientX - o.left, g.clientY - o.top);
      gestureScale = g.scale;
    };
    root.addEventListener("wheel", wheel, { passive: false });
    root.addEventListener("gesturestart", gstart);
    root.addEventListener("gesturechange", gchange);
    return () => {
      root.removeEventListener("wheel", wheel);
      root.removeEventListener("gesturestart", gstart);
      root.removeEventListener("gesturechange", gchange);
    };
  }, [setView, zoomAt]);

  const fit = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const boxes = Object.values(itemsRef.current)
      .filter((i) => i.kind !== "arrow" && !i.parentId)
      .map((i) => boxOf(i.id))
      .filter((b): b is Box => Boolean(b));
    const { width, height } = root.getBoundingClientRect();
    if (!boxes.length) {
      setView({ x: 60, y: 60, k: 1 });
      return;
    }
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h));
    const pad = width < 640 ? 24 : 80;
    const k = clamp(Math.min((width - pad * 2) / (maxX - minX || 1), (height - pad * 2) / (maxY - minY || 1)), MIN_ZOOM, 1);
    // Téléphone : un grand tableau entier serait illisible ; on part du coin en haut à gauche.
    if (width < 640 && k < 0.45) {
      setView({ k: 0.45, x: pad - minX * 0.45, y: pad - minY * 0.45 });
      return;
    }
    setView({ k, x: (width - (maxX - minX) * k) / 2 - minX * k, y: Math.max(pad, (height - (maxY - minY) * k) / 2) - minY * k });
  }, [boxOf, setView]);
  fitRef.current = fit;

  // Vue d'ensemble à l'ouverture, dès que la zone du tableau a sa taille définitive.
  useLayoutEffect(() => {
    const root = rootRef.current!;
    const ro = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        ro.disconnect();
        fit();
      }
    });
    ro.observe(root);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ——— Flèches et barre de la carte sélectionnée (mesurées après chaque rendu) ———

  // mx/my : milieu de la flèche (poignée de courbure) ; cx/cy + nx/ny : milieu de la ligne droite et sa perpendiculaire.
  type ArrowGeom = { id: string; d: string; mx: number; my: number; cx: number; cy: number; nx: number; ny: number };
  const [geom, setGeom] = useState<{ arrows: ArrowGeom[]; sel: Box | null }>({ arrows: [], sel: null });
  useLayoutEffect(() => {
    const next = {
      arrows: arrows.flatMap((a) => {
        const A = a.data.from ? boxOf(a.data.from) : null;
        const B = a.data.to ? boxOf(a.data.to) : null;
        if (!A || !B) return [];
        const ax = A.x + A.w / 2;
        const ay = A.y + A.h / 2;
        const bx = B.x + B.w / 2;
        const by = B.y + B.h / 2;
        const len = Math.hypot(bx - ax, by - ay) || 1;
        const nx = -(by - ay) / len;
        const ny = (bx - ax) / len;
        const cx = (ax + bx) / 2;
        const cy = (ay + by) / 2;
        const bend = a.data.bend ?? 0;
        // Flèche courbe : elle passe par le point « sommet », décalé de `bend` à angle droit de la ligne droite.
        const top = { x: cx + nx * bend, y: cy + ny * bend };
        const p = edgePoint(A, bend ? top.x : bx, bend ? top.y : by, 6);
        const q = edgePoint(B, bend ? top.x : ax, bend ? top.y : ay, 8);
        const f = (n: number) => n.toFixed(1);
        const d = bend
          ? `M${f(p.x)},${f(p.y)} Q${f(2 * top.x - (p.x + q.x) / 2)},${f(2 * top.y - (p.y + q.y) / 2)} ${f(q.x)},${f(q.y)}`
          : `M${f(p.x)},${f(p.y)} L${f(q.x)},${f(q.y)}`;
        return [{ id: a.id, d, mx: bend ? top.x : (p.x + q.x) / 2, my: bend ? top.y : (p.y + q.y) / 2, cx, cy, nx, ny }];
      }),
      sel: selected && items[selected] && items[selected].kind !== "arrow" ? boxOf(selected) : null,
    };
    if (JSON.stringify(next) !== JSON.stringify(geom)) setGeom(next);
  });

  // Menu « Plus » de la barre du haut → fenêtre d'import.
  useEffect(() => {
    const open = () => setImportOpen(true);
    window.addEventListener("board:import", open);
    return () => window.removeEventListener("board:import", open);
  }, []);

  // ——— Clavier, coller, fichiers glissés ———

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea")) return;
      if (e.key === " ") spaceDown.current = true;
      if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "x") && !e.shiftKey) {
        if (!copySelection()) return;
        copyPending.current = Date.now();
        // Pas de preventDefault : l'événement « copy » natif suit et remplit le presse-papiers (plus sûr que writeText).
        if (e.key === "x") {
          // Couper : copier puis retirer (Cmd + Z les fait revenir).
          if (groupRef.current.length > 1) removeGroup(false);
          else if (selected) remove(selected);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D") && canAdd) {
        // Cmd + D : dupliquer la sélection juste à côté (sans toucher au presse-papiers).
        const payload = serializeSelection();
        if (!payload) return;
        e.preventDefault();
        ensureName(() => pasteCards(payload));
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z" || e.key === "y")) {
        e.preventDefault();
        if (e.key === "y" || e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && groupRef.current.length > 1) {
        e.preventDefault();
        removeGroup();
      } else if ((e.key === "a" || e.key === "A") && (e.metaKey || e.ctrlKey)) {
        // Cmd/Ctrl + A : tout sélectionner.
        e.preventDefault();
        setSelectedState(null);
        setGroup(Object.values(itemsRef.current).filter((i) => i.kind !== "arrow" && !i.parentId && canEdit(i)).map((i) => i.id));
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        remove(selected);
      } else if (e.key === "Escape") {
        setMenu(null);
        setSelected(null);
        setGroup([]);
        setArrowMode(null);
      }
    };
    const paste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.("input, textarea") || !canAdd) return;
      const pasted = e.clipboardData?.getData("text/plain") ?? "";
      let stored: string | null = null;
      try {
        stored = localStorage.getItem("alvz-board-clip");
      } catch {}
      const cards = pasted.startsWith(CLIP) ? pasted : !pasted ? clipboard.current ?? stored : null;
      if (cards) {
        e.preventDefault();
        ensureName(() => pasteCards(cards));
        return;
      }
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) {
        e.preventDefault();
        addImages(files);
        return;
      }
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (text && /^https?:\/\/\S+$/.test(text)) {
        e.preventDefault();
        addLink(text);
      } else if (text) {
        e.preventDefault();
        ensureName(() => create("note", { text: text.slice(0, 5000), color: "blanc" }));
      }
    };
    // Cmd + C / X : les cartes copiées vont dans le vrai presse-papiers (collables dans un autre onglet).
    const copy = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.("input, textarea") || !clipboard.current || !e.clipboardData) return;
      if (Date.now() - copyPending.current > 1000) return; // copie qui ne vient pas de Cmd + C sur des cartes
      copyPending.current = 0;
      e.clipboardData.setData("text/plain", clipboard.current);
      e.preventDefault();
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.key === " ") spaceDown.current = false;
    };
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("paste", paste);
    window.addEventListener("copy", copy);
    window.addEventListener("cut", copy);
    return () => {
      window.removeEventListener("copy", copy);
      window.removeEventListener("cut", copy);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("keydown", key);
      window.removeEventListener("paste", paste);
    };
  }, [addImages, canAdd, canEdit, copySelection, create, ensureName, pasteCards, redo, remove, removeGroup, selected, serializeSelection, setGroup, setSelected, undo]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canAdd) return;
    const files = [...e.dataTransfer.files];
    if (!files.length) return;
    // Export Milanote (texte ou ZIP) déposé directement sur le tableau.
    if (role === "admin" && files.some((f) => /\.(zip|md|markdown|txt)$/i.test(f.name))) {
      void importMilanote(files);
      return;
    }
    const o = rootRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    addImages(files, { x: (e.clientX - o.left - v.x) / v.k, y: (e.clientY - o.top - v.y) / v.k });
  };

  // ——— Rafraîchissement : nouvelles cartes du client / du studio ———

  const refresh = useCallback(async () => {
    if (document.visibilityState !== "visible" || Date.now() - lastActivity.current > IDLE_STOP_MS) return;
    if (dragId) return;
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) return;
      const { items: server } = (await res.json()) as { items: BoardItem[] };
      const local = itemsRef.current;
      const next: Items = {};
      const keep = (id: string) => sync.isPending(id) || uploading.current.has(id) || editing?.id === id || dragId === id;
      for (const s of server) next[s.id] = keep(s.id) && local[s.id] ? local[s.id] : { ...s, src: s.src ?? local[s.id]?.src ?? null };
      for (const l of Object.values(local)) if (!next[l.id] && keep(l.id)) next[l.id] = l;
      // Changements venus d'ailleurs (le client, un autre appareil) : ils ne sont pas « annulables » ici.
      const base = { ...committed.current };
      for (const id of new Set([...Object.keys(base), ...Object.keys(next)])) {
        if (touched.current.has(id) || keep(id)) continue;
        if (next[id]) base[id] = next[id];
        else delete base[id];
      }
      committed.current = base;
      setItems(next);
    } catch {
      // Hors connexion : on réessaiera.
    }
  }, [dragId, editing, endpoint, setItems, sync]);

  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS);
    const vis = () => {
      if (document.visibilityState === "visible") {
        lastActivity.current = Date.now();
        void refresh();
      } else void sync.flush(true);
    };
    const leave = (e: BeforeUnloadEvent) => {
      if (!sync.busy) return;
      void sync.flush(true);
      e.preventDefault();
    };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("beforeunload", leave);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("beforeunload", leave);
    };
  }, [refresh, sync]);

  // ——— Rendu des cartes ———

  const finishEdit = (it: BoardItem) => {
    setEditing((cur) => (cur?.id === it.id ? null : cur));
    const cur = itemsRef.current[it.id];
    if (cur?.kind === "note" && !cur.data.text?.trim()) remove(it.id);
    if (cur?.kind === "link" && !cur.data.url?.trim() && !cur.data.text) remove(it.id);
  };

  const startEdit = (it: BoardItem) => {
    if (!canEdit(it)) return;
    setSelected(it.id);
    setEditing({
      id: it.id,
      field:
        it.kind === "todo" || it.kind === "column" || it.kind === "board" || it.kind === "color"
          ? "title"
          : it.kind === "image"
            ? "caption"
            : it.kind === "table"
              ? "c:0:0"
              : it.kind === "comment"
                ? "reply"
                : undefined,
    });
  };

  function renderCard(it: BoardItem, inColumn = false) {
    const editable = canEdit(it);
    const isSel = selected === it.id;
    const inGroup = group.includes(it.id);
    const isDrag = dragId === it.id;
    const ed = editing?.id === it.id ? editing : null;
    const style: React.CSSProperties = inColumn
      ? {}
      : { position: "absolute", left: it.x, top: it.y, width: it.w, zIndex: isDrag ? 100000 : zRank.get(it.id) };
    // Mode flèche : la carte entière se choisit d'un toucher (cases, liens et textes inactifs).
    const pickable = arrowMode ? "cursor-crosshair [&_*]:pointer-events-none" : "";
    const firstPick = arrowMode?.from === it.id;
    const shell =
      it.kind === "column"
        ? "p-2.5 border border-line"
        : `border border-line shadow-[0_1px_3px_rgba(0,0,0,0.08)] ${isDrag ? "shadow-[0_12px_30px_rgba(0,0,0,0.18)] rotate-[0.6deg]" : ""}`;
    return (
      <div
        key={it.id}
        data-item={it.id}
        data-child-of={inColumn ? it.parentId ?? undefined : undefined}
        style={{
          ...style,
          background:
            it.kind === "column"
              ? it.data.hex ??
                (it.data.color && it.data.color !== "blanc" ? noteBg(it.data.color) : "color-mix(in srgb, var(--ink) 4%, var(--bg-soft))")
              : it.kind === "color"
                ? "var(--bg)"
                : noteBg(it.data.color, it.data.hex),
          // Colonne : seul son en-tête prend la couleur de texte (ses cartes gardent la leur).
          ...(it.kind !== "color" && it.kind !== "column" ? inkStyle(it.data) : null),
          outline: isSel || firstPick || inGroup ? "2px solid #10b981" : undefined,
          outlineOffset: 1,
          ...(it.data.fontSize ? { fontSize: `${13 * it.data.fontSize}px` } : null),
        }}
        className={`rounded-[3px] text-[13px] leading-relaxed select-none ${inColumn ? "relative" : ""} ${shell} ${pickable} ${editable && !arrowMode ? "cursor-grab active:cursor-grabbing" : ""}`}
        onPointerDown={(e) => startDrag(e, it)}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest("input, textarea, button, a")) return;
          e.stopPropagation();
          if (it.kind === "board") openBoard(it);
          else if (it.kind !== "column" || (e.target as HTMLElement).closest("[data-col-head]")) startEdit(it);
        }}
      >
        {it.kind === "note" && (
          <div className="px-3.5 py-3">
            {ed ? (
              <AutoTextarea value={it.data.text ?? ""} onChange={(text) => updateData(it.id, { text })} onDone={() => finishEdit(it)} placeholder="Écrivez…" />
            ) : (
              <NoteText text={it.data.text ?? ""} />
            )}
          </div>
        )}

        {it.kind === "image" && (
          <div>
            {it.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              it.data.crop ? (
                // Image rognée : seule la zone choisie est visible (le fichier d'origine reste entier).
                <div
                  className="relative overflow-hidden"
                  style={{ aspectRatio: `${(it.data.width ?? 4) * it.data.crop.w} / ${(it.data.height ?? 3) * it.data.crop.h}` }}
                >
                  <img
                    src={it.src}
                    alt={it.data.caption || ""}
                    draggable={false}
                    data-cap="crop"
                    onLoad={() => setTick((t) => t + 1)}
                    className="absolute max-w-none pointer-events-none"
                    style={{
                      width: `${100 / it.data.crop.w}%`,
                      left: `${(-it.data.crop.x / it.data.crop.w) * 100}%`,
                      top: `${(-it.data.crop.y / it.data.crop.h) * 100}%`,
                      aspectRatio: `${it.data.width ?? 4} / ${it.data.height ?? 3}`,
                    }}
                  />
                </div>
              ) : (
                <img
                  src={it.src}
                  alt={it.data.caption || ""}
                  draggable={false}
                  data-cap=""
                  onLoad={() => setTick((t) => t + 1)}
                  className="block w-full h-auto pointer-events-none"
                  style={{ aspectRatio: `${it.data.width ?? 4} / ${it.data.height ?? 3}` }}
                />
              )
            ) : (
              <button
                data-nodrag
                disabled={role !== "admin" || uploading.current.has(it.id)}
                onClick={() => {
                  // Case photo vide : on choisit l'image qui prend sa place.
                  fillTarget.current = it.id;
                  fileRef.current?.click();
                }}
                className="w-full flex flex-col items-center justify-center gap-2 text-muted hover:text-ink transition-colors"
                style={{ aspectRatio: `${it.data.width ?? 4} / ${it.data.height ?? 3}`, background: "color-mix(in srgb, var(--ink) 6%, var(--bg-soft))" }}
                title={role === "admin" ? "Ajouter une image" : undefined}
              >
                <UploadIcon className="w-10 h-10" />
                {role === "admin" && <span className="text-[11px]">Ajouter une image</span>}
              </button>
            )}
            {uploading.current.has(it.id) && <div className="absolute inset-x-0 top-0 h-0.5 bg-emerald-500 animate-pulse" />}
            {ed ? (
              <div className="px-3 py-2">
                <InlineInput value={it.data.caption ?? ""} onChange={(caption) => updateData(it.id, { caption })} onDone={() => finishEdit(it)} placeholder="Légende" className="text-xs" />
              </div>
            ) : (
              it.data.caption && <p className="px-3 py-2 text-xs text-muted">{it.data.caption}</p>
            )}
          </div>
        )}

        {it.kind === "todo" && renderTodo(it, editable, ed)}
        {it.kind === "board" && renderBoardCard(it, ed)}
        {it.kind === "color" && renderColor(it, ed)}
        {it.kind === "link" && renderLink(it, ed)}
        {it.kind === "table" && renderTable(it, editable, ed, isSel)}
        {it.kind === "comment" && renderComment(it, ed)}

        {it.kind === "column" && (
          <div>
            <div data-col-head className="flex items-baseline gap-2 px-1 pb-2.5 pt-0.5" style={inkStyle(it.data) ?? undefined}>
              {ed?.field === "title" ? (
                <InlineInput value={it.data.title ?? ""} onChange={(title) => updateData(it.id, { title })} onDone={() => finishEdit(it)} placeholder="Nom de la colonne" className="text-sm font-medium" />
              ) : (
                <p className="flex-1 text-sm font-medium truncate">{it.data.title || <span className="text-muted">Colonne</span>}</p>
              )}
              <span className="text-[11px] text-muted shrink-0">{childrenOf(it.id).length || ""}</span>
            </div>
            <div className="flex flex-col gap-2 min-h-16">
              {childrenOf(it.id).map((ch, i) => (
                <Fragment key={ch.id}>
                  {dropTarget?.col === it.id && dropTarget.index === i && <DropBar />}
                  {renderCard(ch, true)}
                </Fragment>
              ))}
              {dropTarget?.col === it.id && dropTarget.index >= childrenOf(it.id).length && <DropBar />}
              {childrenOf(it.id).length === 0 && dropTarget?.col !== it.id && (
                <p className="text-[11px] text-muted text-center py-5 border border-dashed border-line rounded-[3px]">Glissez des cartes ici</p>
              )}
            </div>
          </div>
        )}

        {it.author && (
          <p className={`text-[10px] text-muted truncate ${it.kind === "column" ? "px-1 pt-2" : it.kind === "image" ? "px-3 py-1.5" : "px-3.5 pb-2 -mt-1"}`}>— {it.author}</p>
        )}

        {isSel && editable && !inColumn && !arrowMode && (
          <span
            data-nodrag
            onPointerDown={(e) => startResize(e, it)}
            className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 bg-bg border-2 border-emerald-500 rounded-full cursor-ew-resize touch-none"
            title="Largeur"
          />
        )}
      </div>
    );
  }

  /** Carte « tableau » : aperçu de ce qu'il contient ; double-clic (ou « Ouvrir ») pour y entrer. */
  function renderBoardCard(it: BoardItem, ed: Editing) {
    const covers = it.sub?.covers ?? [];
    const title = it.sub?.title ?? it.data.title ?? "";
    return (
      <div className="p-2">
        <div className="aspect-[4/3] bg-bg-soft overflow-hidden grid grid-cols-2 grid-rows-2 gap-px">
          {covers.length && !BOARD_ICONS[it.data.icon ?? ""] ? (
            covers.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt=""
                draggable={false}
                className={`w-full h-full object-cover pointer-events-none ${covers.length === 1 ? "col-span-2 row-span-2" : covers.length === 2 ? "row-span-2" : covers.length === 3 && i === 0 ? "row-span-2" : ""}`}
              />
            ))
          ) : (
            <span className="col-span-2 row-span-2 flex items-center justify-center text-muted">
              {(() => {
                const Icon = BOARD_ICONS[it.data.icon ?? ""] ?? BoardIcon;
                return <Icon className={it.data.icon ? "w-12 h-12" : "w-7 h-7"} />;
              })()}
            </span>
          )}
        </div>
        <div className="px-1 pt-2">
          {ed?.field === "title" ? (
            <InlineInput
              value={title}
              onChange={(t) => update(it.id, { data: { ...it.data, title: t }, sub: { title: t, count: it.sub?.count ?? 0, covers: it.sub?.covers ?? [] } })}
              onDone={() => finishEdit(it)}
              placeholder="Nom du tableau"
              className="font-medium"
            />
          ) : (
            <p className="font-medium truncate">{title || <span className="text-muted">Sans titre</span>}</p>
          )}
          <p className="text-[11px] text-muted">
            {it.sub ? `${it.sub.count} carte${it.sub.count > 1 ? "s" : ""}` : "Tableau"} · double-clic pour ouvrir
          </p>
        </div>
      </div>
    );
  }

  /** Carte « couleur » (palette, étalonnage) : teinte, nom et code. */
  function renderColor(it: BoardItem, ed: Editing) {
    const hex = it.data.hex ?? "#c8a27a";
    return (
      <div>
        <div className="relative w-full rounded-t-[2px]" style={{ background: hex, aspectRatio: "16 / 10" }}>
          {ed && (
            <input
              type="color"
              value={hex}
              onChange={(e) => updateData(it.id, { hex: e.target.value })}
              className="absolute right-2 bottom-2 w-9 h-9 cursor-pointer bg-transparent"
              aria-label="Choisir la couleur"
            />
          )}
        </div>
        <div className="px-3 py-2">
          {ed?.field === "title" ? (
            <InlineInput value={it.data.title ?? ""} onChange={(t) => updateData(it.id, { title: t })} onDone={() => finishEdit(it)} placeholder="Nom de la couleur" />
          ) : (
            <p className="truncate">{it.data.title || <span className="text-muted">Couleur</span>}</p>
          )}
          <p className="text-[11px] text-muted uppercase tracking-wider">{hex}</p>
        </div>
      </div>
    );
  }

  /** Carte « lien » : lecteur YouTube / Vimeo / Spotify / SoundCloud / Deezer, ou simple lien. */
  function renderLink(it: BoardItem, ed: Editing) {
    const url = it.data.url ?? "";
    if (ed || !url) {
      return (
        <div className="px-3.5 py-3">
          {ed ? (
            <InlineInput
              value={url}
              onChange={(v) => updateData(it.id, { url: v.trim() })}
              onDone={() => finishEdit(it)}
              placeholder={it.data.text || "Collez un lien YouTube, Vimeo, Spotify…"}
              className="text-xs"
            />
          ) : (
            <button
              data-nodrag
              disabled={!canEdit(it)}
              onClick={() => setEditing({ id: it.id })}
              className="w-full flex items-center gap-3 text-left text-xs text-muted py-1"
            >
              <span className="w-6 h-6 shrink-0 rounded-full border border-line flex items-center justify-center text-[9px] pl-px">▶</span>
              {it.data.text || "Lien vide"}
            </button>
          )}
        </div>
      );
    }
    const e = linkEmbed(url);
    const video = e?.provider === "youtube" || e?.provider === "vimeo";
    if (e?.embed && playing === it.id) {
      return (
        <div data-nodrag>
          <iframe
            src={e.embed}
            title={e.label}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write"
            allowFullScreen
            className="block w-full border-0 rounded-t-[2px]"
            style={video ? { aspectRatio: "16 / 9" } : { height: e.height ?? 152 }}
          />
          <button data-nodrag onClick={() => setPlaying(null)} className="w-full text-left px-3.5 py-2 text-[11px] text-muted hover:text-ink">
            ■ Arrêter · {e.label}
          </button>
        </div>
      );
    }
    return (
      <div>
        {video && (
          <button data-nodrag onClick={() => setPlaying(it.id)} className="relative block w-full aspect-video bg-black overflow-hidden rounded-t-[2px]" aria-label="Lire">
            {e.thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={e.thumb}
                alt=""
                draggable={false}
                onError={(ev) => (ev.currentTarget.style.display = "none")}
                className="absolute inset-0 w-full h-full object-cover opacity-90"
              />
            )}
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-12 h-12 rounded-full bg-black/60 text-white flex items-center justify-center text-lg pl-1">▶</span>
            </span>
          </button>
        )}
        {!video && e?.embed && (
          <button data-nodrag onClick={() => setPlaying(it.id)} className="w-full flex items-center gap-3 px-3.5 pt-3 text-left">
            <span className="w-9 h-9 shrink-0 rounded-full bg-ink text-bg flex items-center justify-center text-sm pl-0.5">▶</span>
            <span className="text-xs text-muted">Écouter sur la carte</span>
          </button>
        )}
        {/* Seul le texte du lien l'ouvre : le reste de la carte sert à la saisir et la déplacer. */}
        <div className="px-3.5 py-2.5">
          <span className="block text-[10px] uppercase tracking-widest opacity-60">{e?.label ?? "Lien"}</span>
          <a data-nodrag href={url} target="_blank" rel="noreferrer noopener" className="inline-block max-w-full align-top text-xs truncate underline underline-offset-2 hover:opacity-80">
            {it.data.title || url.replace(/^https?:\/\/(www\.)?/, "")}
          </a>
        </div>
      </div>
    );
  }

  /** Carte « tableau » : grille de cellules (1re ligne en gras), comme le Tableau de Milanote. */
  function renderTable(it: BoardItem, editable: boolean, ed: Editing, isSel: boolean) {
    const cells = it.data.cells?.length ? it.data.cells : [["", "", ""]];
    const cols = cells[0].length;
    const setCells = (next: string[][]) => updateData(it.id, { cells: next });
    const field = (r: number, c: number) => `c:${r}:${c}`;
    const go = (r: number, c: number) => {
      if (selected !== it.id) setSelected(it.id);
      setEditing({ id: it.id, field: field(r, c) });
    };
    // Colonne « Fait » : cases à cocher.
    const doneCol = cells[0].findIndex((h) => h.trim().toLowerCase() === "fait");
    const budget = it.data.calc === "budget" ? budgetFigures(cells) : null;
    return (
      <div className="px-2 pt-3 pb-2">
        {it.data.title !== undefined && (
          <p className="text-center font-semibold tracking-wide py-3" style={{ fontFamily: "var(--font-playfair), serif" }}>
            {it.data.title}
          </p>
        )}
        <table className="w-full table-fixed border-collapse text-[0.92em] leading-snug">
          <tbody>
            {cells.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => {
                  const here = ed?.field === field(r, c);
                  const auto = budget?.auto.get(`${r}:${c}`); // valeur calculée (budget)
                  const tone = budget?.tone.get(`${r}:${c}`);
                  if (doneCol === c && r > 0) {
                    const on = cell.trim() !== "";
                    return (
                      <td key={c} className="border align-middle text-center px-2 py-1.5" style={{ borderColor: "color-mix(in srgb, currentColor 18%, transparent)" }}>
                        <button
                          data-nodrag
                          disabled={!editable}
                          onClick={() => setCells(cells.map((rr, i) => (i === r ? rr.map((x, j) => (j === c ? (on ? "" : "x") : x)) : rr)))}
                          className={`w-[15px] h-[15px] rounded-[3px] border inline-flex items-center justify-center text-[10px] ${on ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted"}`}
                          aria-label={on ? "Décocher" : "Cocher"}
                        >
                          {on ? "✓" : ""}
                        </button>
                      </td>
                    );
                  }
                  return (
                    <td
                      key={c}
                      data-nodrag={editable && !auto ? "" : undefined}
                      onClick={editable && !here && !auto ? () => go(r, c) : undefined}
                      className={`border border-current/15 align-top px-2 py-1.5 ${r === 0 || budget?.boldRows.has(r) ? "font-semibold" : ""} ${editable && !auto ? "cursor-text" : ""} ${auto ? "text-right tabular-nums" : ""}`}
                      style={{
                        borderColor: "color-mix(in srgb, currentColor 18%, transparent)",
                        ...(r === 0 ? { background: "color-mix(in srgb, currentColor 10%, transparent)" } : null),
                        ...(tone === "total" ? { background: "#b85445", color: "#fff" } : tone === "profit" ? { background: "#6fcf4f", color: "#1b1a19" } : tone === "loss" ? { background: "#e0533f", color: "#fff" } : null),
                      }}
                    >
                      {auto ? (
                        <span className={auto.computed ? "opacity-90" : ""}>{auto.text}</span>
                      ) : here ? (
                        <AutoTextarea
                          value={cell}
                          onChange={(v) => setCells(cells.map((rr, i) => (i === r ? rr.map((x, j) => (j === c ? v : x)) : rr)))}
                          onDone={() => setEditing((cur) => (cur?.id === it.id && cur.field === field(r, c) ? null : cur))}
                          onKey={(e) => {
                            // Tab : cellule suivante ; Entrée : cellule du dessous (Maj + Entrée : retour à la ligne).
                            if (e.key === "Tab") {
                              e.preventDefault();
                              const n = r * cols + c + (e.shiftKey ? -1 : 1);
                              if (n >= 0 && n < cells.length * cols) go(Math.floor(n / cols), n % cols);
                            } else if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (r + 1 < cells.length) go(r + 1, c);
                              else if (cells.length < TABLE_MAX_ROWS) {
                                setCells([...cells, Array.from({ length: cols }, () => "")]);
                                go(r + 1, c);
                              }
                            }
                          }}
                        />
                      ) : cell ? (
                        <span className="block whitespace-pre-wrap break-words">
                          <Linkified text={cell} />
                        </span>
                      ) : (
                        <span className="opacity-30">{r === 0 ? "Titre" : "…"}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {editable && isSel && (
          <div data-nodrag className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] opacity-70">
            {cells.length < TABLE_MAX_ROWS && (
              <button data-nodrag onClick={() => setCells([...cells, Array.from({ length: cols }, () => "")])} className="hover:opacity-100">
                + Ligne
              </button>
            )}
            {cols < TABLE_MAX_COLS && (
              <button data-nodrag onClick={() => setCells(cells.map((rr) => [...rr, ""]))} className="hover:opacity-100">
                + Colonne
              </button>
            )}
            {cells.length > 1 && (
              <button data-nodrag onClick={() => setCells(cells.slice(0, -1))} className="hover:opacity-100">
                − Ligne
              </button>
            )}
            {cols > 1 && (
              <button data-nodrag onClick={() => setCells(cells.map((rr) => rr.slice(0, -1)))} className="hover:opacity-100">
                − Colonne
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  /** Carte « commentaire » : la discussion (studio = logo ALVZ.REC, client = son prénom) et le champ de réponse. */
  function renderComment(it: BoardItem, ed: Editing) {
    const list = it.comments ?? [];
    const draft = replies[it.id] ?? "";
    const canWrite = canAdd;
    return (
      <div className="px-3.5 py-3 space-y-3">
        {list.map((m) => (
          <div key={m.id} className="group/msg flex gap-2.5">
            <Avatar name={m.author} studio={m.studio} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] flex items-baseline gap-2">
                <span className="font-medium">{m.studio ? "ALVZ.REC" : m.author}</span>
                <span className="opacity-50">{when(m.at)}</span>
                {m.mine && !m.id.startsWith("tmp-") && (
                  <button data-nodrag onClick={() => void deleteComment(it, m.id)} className="ml-auto opacity-0 group-hover/msg:opacity-60 hover:!opacity-100" aria-label="Effacer le message">
                    ×
                  </button>
                )}
              </p>
              <p className="whitespace-pre-wrap break-words">
                <Linkified text={m.body} />
              </p>
            </div>
          </div>
        ))}
        {canWrite ? (
          <div className="flex items-start gap-2.5">
            <Avatar name={role === "admin" ? "ALVZ.REC" : name ?? "?"} studio={role === "admin"} />
            <div data-nodrag className="flex-1 min-w-0 flex items-end gap-2 rounded-[4px] px-2.5 py-1.5" style={{ background: "color-mix(in srgb, currentColor 7%, transparent)" }}>
              {ed?.field === "reply" ? (
                <AutoTextarea
                  value={draft}
                  onChange={(v) => setReplies((r) => ({ ...r, [it.id]: v }))}
                  onDone={() => setEditing((c) => (c?.id === it.id && c.field === "reply" ? null : c))}
                  onKey={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendComment(it);
                    }
                  }}
                  placeholder="Rédigez un commentaire…"
                  className="text-[13px]"
                />
              ) : (
                <button data-nodrag onClick={() => setEditing({ id: it.id, field: "reply" })} className="flex-1 text-left opacity-50 py-0.5">
                  {draft || "Rédigez un commentaire…"}
                </button>
              )}
              <button
                data-nodrag
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => void sendComment(it)}
                disabled={!draft.trim()}
                className="text-[12px] font-medium text-emerald-600 disabled:opacity-30 shrink-0 py-0.5"
              >
                Envoyer
              </button>
            </div>
          </div>
        ) : (
          !list.length && <p className="text-xs opacity-50">Aucun commentaire.</p>
        )}
      </div>
    );
  }

  /**
   * Budget : TOTAL d'une ligne = tarif × jours (si la case TOTAL est vide) ; ligne « TOTAL » = somme ;
   * « BUDGET DU CLIENT » = saisi ; « BÉNÉFICE » = budget − total.
   */
  function budgetFigures(cells: string[][]) {
    const num = (v: string) => {
      const n = parseFloat(v.replace(/[\s€]/g, "").replace(",", "."));
      return Number.isFinite(n) ? n : null;
    };
    const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
    const label = (r: number) => cells[r][0].trim().toUpperCase();
    const last = cells[0].length - 1;
    const auto = new Map<string, { text: string; computed: boolean }>();
    const tone = new Map<string, "total" | "profit" | "loss">();
    const boldRows = new Set<number>();
    const totalRow = cells.findIndex((_, r) => r > 0 && label(r) === "TOTAL");
    const clientRow = cells.findIndex((_, r) => r > 0 && label(r).startsWith("BUDGET"));
    const profitRow = cells.findIndex((_, r) => r > 0 && label(r).startsWith("BÉNÉFICE"));
    let sum = 0;
    cells.forEach((row, r) => {
      if (r === 0 || r === totalRow || r === clientRow || r === profitRow) return;
      const typed = num(row[last]);
      const rate = num(row[1] ?? "");
      const days = num(row[2] ?? "");
      if (!row[last]?.trim() && rate !== null) {
        const v = rate * (days ?? 1);
        auto.set(`${r}:${last}`, { text: eur(v), computed: true });
        sum += v;
      } else if (typed !== null) sum += typed;
      if (row[0] && row[0] === row[0].toUpperCase() && !rate && !days) boldRows.add(r); // titres de section (DÉPLACEMENTS)
    });
    if (totalRow > 0) {
      auto.set(`${totalRow}:${last}`, { text: eur(sum), computed: true });
      boldRows.add(totalRow);
      cells[totalRow].forEach((_, c) => tone.set(`${totalRow}:${c}`, "total"));
    }
    const client = clientRow > 0 ? num(cells[clientRow][last]) : null;
    if (clientRow > 0) boldRows.add(clientRow);
    if (profitRow > 0) {
      const profit = (client ?? 0) - sum;
      auto.set(`${profitRow}:${last}`, { text: eur(profit), computed: true });
      boldRows.add(profitRow);
      tone.set(`${profitRow}:${last}`, profit < 0 ? "loss" : "profit");
    }
    return { auto, tone, boldRows };
  }

  function renderTodo(it: BoardItem, editable: boolean, ed: Editing) {
    const entries = it.data.items ?? [];
    const done = entries.filter((e) => e.done).length;
    const setEntries = (next: typeof entries) => updateData(it.id, { items: next });
    const addAfter = (index: number) => {
      // Une nouvelle ligne garde le retrait de celle du dessus (sous-éléments à la suite).
      const above = entries[index];
      const entry = { id: crypto.randomUUID(), text: "", done: false, ...(above?.indent ? { indent: above.indent } : {}) };
      setEntries([...entries.slice(0, index + 1), entry, ...entries.slice(index + 1)]);
      setEditing({ id: it.id, field: entry.id });
    };
    return (
      <div className="px-3.5 py-3">
        <div className="flex items-baseline gap-2 mb-1.5">
          {ed?.field === "title" ? (
            <InlineInput
              value={it.data.title ?? ""}
              onChange={(title) => updateData(it.id, { title })}
              onDone={() => setEditing((c) => (c?.id === it.id && c.field === "title" ? null : c))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (entries[0]) setEditing({ id: it.id, field: entries[0].id });
                  else addAfter(-1);
                }
              }}
              placeholder="Titre de la liste"
              className="font-medium"
            />
          ) : (
            <p className="flex-1 font-medium">{it.data.title || <span className="text-muted">Liste</span>}</p>
          )}
          {entries.length > 0 && <span className="text-[11px] text-muted shrink-0">{done}/{entries.length}</span>}
        </div>
        <ul className="space-y-1">
          {entries.map((entry, i) => (
            <li key={entry.id} className="group/entry flex items-start gap-2" style={entry.indent ? { paddingLeft: entry.indent * 22 } : undefined}>
              <button
                data-nodrag
                disabled={!editable}
                onClick={() => setEntries(entries.map((x) => (x.id === entry.id ? { ...x, done: !x.done } : x)))}
                className={`mt-[3px] w-[15px] h-[15px] shrink-0 rounded-[3px] border flex items-center justify-center text-[10px] ${entry.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted"}`}
                aria-label={entry.done ? "Décocher" : "Cocher"}
              >
                {entry.done ? "✓" : ""}
              </button>
              {ed?.field === entry.id ? (
                <InlineInput
                  value={entry.text}
                  onChange={(text) => setEntries(entries.map((x) => (x.id === entry.id ? { ...x, text } : x)))}
                  onDone={() => setEditing((c) => (c?.id === it.id && c.field === entry.id ? null : c))}
                  onKeyDown={(e) => {
                    if (e.key === "Tab") {
                      // Tab : en retrait (sous-élément) ; Maj + Tab : retour à gauche.
                      e.preventDefault();
                      const indent = Math.max(0, Math.min(2, (entry.indent ?? 0) + (e.shiftKey ? -1 : 1)));
                      setEntries(entries.map((x) => (x.id === entry.id ? { ...x, indent: indent || undefined } : x)));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      addAfter(i);
                    } else if (e.key === "Backspace" && !entry.text && entry.indent) {
                      e.preventDefault();
                      setEntries(entries.map((x) => (x.id === entry.id ? { ...x, indent: entry.indent! - 1 || undefined } : x)));
                    } else if (e.key === "Backspace" && !entry.text) {
                      e.preventDefault();
                      setEntries(entries.filter((x) => x.id !== entry.id));
                      setEditing(entries[i - 1] ? { id: it.id, field: entries[i - 1].id } : null);
                    }
                  }}
                  className={entry.done ? "line-through text-muted" : ""}
                />
              ) : (
                <span
                  data-nodrag={editable ? "" : undefined}
                  onClick={editable ? () => setEditing({ id: it.id, field: entry.id }) : undefined}
                  className={`flex-1 min-w-0 break-words ${entry.done ? "line-through text-muted" : ""} ${editable ? "cursor-text" : ""}`}
                >
                  {entry.text || <span className="text-muted">…</span>}
                </span>
              )}
              {editable && (
                <button
                  data-nodrag
                  onClick={() => setEntries(entries.filter((x) => x.id !== entry.id))}
                  className="opacity-0 group-hover/entry:opacity-100 text-muted hover:text-ink text-xs leading-5"
                  aria-label="Retirer"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <button data-nodrag onClick={() => addAfter(entries.length - 1)} className="mt-2 text-xs text-muted hover:text-ink">
            + Ajouter
          </button>
        )}
      </div>
    );
  }

  // ——— Interface ———

  const sel = selected ? items[selected] : null;
  const selEditable = sel ? canEdit(sel) : false;

  // ——— Menu du clic droit ———

  const openMenu = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    // Dans un champ de texte : le menu habituel du navigateur (copier / coller du texte, correcteur).
    if (t.closest("input, textarea, [contenteditable], [data-ui]")) return;
    e.preventDefault();
    const o = rootRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    const card = t.closest<HTMLElement>("[data-item]")?.dataset.item ?? null;
    if (card && !groupRef.current.includes(card)) setSelected(card);
    if (!card) setSelected(null);
    setEditing(null);
    setArrowMode(null);
    setMenu({
      left: e.clientX - o.left,
      top: e.clientY - o.top,
      at: { x: (e.clientX - o.left - v.x) / v.k, y: (e.clientY - o.top - v.y) / v.k },
      target: card,
    });
  };

  /** Cartes visées par le menu : la sélection multiple si la carte en fait partie, sinon la carte seule. */
  const menuIds = () => (menu?.target ? (groupRef.current.includes(menu.target) ? [...groupRef.current] : [menu.target]) : []);

  /** « Coller » du menu : le presse-papiers du système si le navigateur le permet, sinon la dernière copie. */
  const pasteFromMenu = async (at: { x: number; y: number }) => {
    let text = "";
    try {
      text = (await navigator.clipboard?.readText()) ?? "";
    } catch {}
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("alvz-board-clip");
    } catch {}
    const cards = text.startsWith(CLIP) ? text : !text ? clipboard.current ?? stored : null;
    if (cards) return ensureName(() => pasteCards(cards, at));
    if (/^https?:\/\/\S+$/.test(text.trim())) return addLink(text.trim(), at);
    if (text.trim()) ensureName(() => create("note", { text: text.trim().slice(0, 5000), color: "blanc" }, at));
  };

  /** Premier plan / arrière-plan : les cartes gardent leur ordre entre elles. */
  const restack = (ids: string[], front: boolean) => {
    const list = ids.map((id) => itemsRef.current[id]).filter((i): i is BoardItem => Boolean(i) && canEdit(i)).sort((a, b) => a.z - b.z);
    const all = Object.values(itemsRef.current);
    let z = front ? maxZ() : Math.min(...all.map((i) => i.z)) - list.length - 1;
    for (const it of list) update(it.id, { z: ++z });
  };

  /** Taille du texte d'une ou plusieurs cartes. */
  const applyFontSize = (ids: string[], size: number) => {
    for (const id of ids) {
      const it = itemsRef.current[id];
      if (!it || it.kind === "image" || it.kind === "arrow" || !canEdit(it)) continue;
      update(id, { data: { ...it.data, fontSize: size === 1 ? undefined : size } });
    }
  };

  /** Flèche : glisser la poignée du milieu la courbe ; revenue près de la ligne droite, elle se redresse. */
  const startBend = (e: React.PointerEvent, a: ArrowGeom) => {
    e.stopPropagation();
    e.preventDefault();
    const o = rootRef.current!.getBoundingClientRect();
    const at = (ev: PointerEvent) => {
      const v = viewRef.current;
      const x = (ev.clientX - o.left - v.x) / v.k;
      const y = (ev.clientY - o.top - v.y) / v.k;
      const bend = Math.round((x - a.cx) * a.nx + (y - a.cy) * a.ny);
      return Math.abs(bend) < 10 ? 0 : bend;
    };
    const move = (ev: PointerEvent) => {
      const it = itemsRef.current[a.id];
      if (it) update(a.id, { data: { ...it.data, bend: at(ev) || undefined } }, false);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const it = itemsRef.current[a.id];
      if (it) update(a.id, { data: { ...it.data, bend: at(ev) || undefined } });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /**
   * Capture du tableau entier, bien cadrée, en haute définition : toutes les cartes, sans les barres d'outils.
   * Assez grande pour zoomer net dans les photos, même sur iPhone (qui refuse les toiles de plus de ~16 Mpx) :
   * on dessine alors le tableau par bandes, assemblées au fil de l'eau en un seul JPEG.
   */
  const capture = async () => {
    const world = worldRef.current;
    const all = itemsRef.current;
    const tops = Object.values(all).filter((i) => i.kind !== "arrow" && !i.parentId);
    const boxes = tops.map((i) => ({ it: i, b: boxOf(i.id) })).filter((x): x is { it: BoardItem; b: Box } => Boolean(x.b));
    if (!world || !boxes.length) return;
    setCapturing("Capture en cours…");
    setSelected(null);
    setGroup([]);
    setEditing(null);
    setMenu(null);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const pad = 48;
      const x0 = Math.min(...boxes.map(({ b }) => b.x)) - pad;
      const y0 = Math.min(...boxes.map(({ b }) => b.y)) - pad;
      const w = Math.ceil(Math.max(...boxes.map(({ b }) => b.x + b.w)) + pad - x0);
      const h = Math.ceil(Math.max(...boxes.map(({ b }) => b.y + b.h)) + pad - y0);
      // Jusqu'à 6 fois la taille à l'écran (photos posées en 1600 px), 64 millions de pixels au plus.
      let ratio = Math.max(1, Math.min(6, Math.sqrt(64_000_000 / (w * h)), 16384 / w));
      let rows = 0;
      // Hauteur de bande que ce navigateur accepte (on essaie vraiment : la limite change selon l'appareil).
      for (;;) {
        rows = maxCanvasRows(Math.round(w * ratio), isWebKit() ? 12_000_000 : 64_000_000);
        if (rows >= 256 || ratio <= 1) break;
        ratio = Math.max(1, ratio * 0.8);
      }
      if (!rows) throw new Error("Ce navigateur ne peut pas dessiner l'image");
      const W = Math.round(w * ratio);
      const H = Math.round(h * ratio);
      const strips = Math.ceil(H / rows);

      const { toCanvas } = await import("html-to-image");
      const bg = getComputedStyle(rootRef.current!).backgroundColor;
      const base = {
        width: w,
        pixelRatio: ratio,
        backgroundColor: bg,
        filter: (n: HTMLElement) => !(n instanceof HTMLElement && n.dataset.ui !== undefined),
        imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==",
      };
      await Promise.all([...world.querySelectorAll("img")].map((img) => img.decode().catch(() => undefined)));
      // Safari dessine parfois les photos en noir au premier essai : un premier passage, tout petit, pour rien.
      if (isWebKit()) {
        const warm = await toCanvas(world, { ...base, pixelRatio: 0.25, height: h, style: { transform: `translate(${-x0}px, ${-y0}px)`, transformOrigin: "0 0" } });
        warm.width = warm.height = 0;
      }

      // Photos des cartes image : redessinées par-dessus depuis leur fichier, en pleine netteté
      // (et jamais noires), sauf si une autre carte passe au-dessus.
      const wr = world.getBoundingClientRect();
      const k = viewRef.current.k;
      const toWorld = (r: DOMRect): Box => ({ x: (r.left - wr.left) / k - x0, y: (r.top - wr.top) / k - y0, w: r.width / k, h: r.height / k });
      const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      const topOf = (id: string) => {
        let it = all[id];
        while (it?.parentId && all[it.parentId]) it = all[it.parentId];
        return it;
      };
      const photos = [...world.querySelectorAll<HTMLImageElement>("img[data-cap]")].flatMap((img) => {
        const id = img.closest<HTMLElement>("[data-item]")?.dataset.item;
        const top = id ? topOf(id) : undefined;
        if (!top || !img.naturalWidth) return [];
        const rect = toWorld(img.getBoundingClientRect());
        const clip = toWorld((img.dataset.cap === "crop" ? img.parentElement! : img).getBoundingClientRect());
        const covered = boxes.some(({ it, b }) => it.id !== top.id && it.z > top.z && hit({ ...b, x: b.x - x0, y: b.y - y0 }, clip));
        return covered ? [] : [{ img, rect, clip }];
      });

      const jpeg = strips > 1 ? (await import("@/lib/client/jpeg-stream")).createJpegStream(92) : null;
      jpeg?.begin(W, H);
      let single: HTMLCanvasElement | null = null;
      for (let i = 0; i < strips; i++) {
        if (strips > 1) setCapturing(`Capture en cours… ${i + 1} / ${strips}`);
        const r0 = i * rows;
        const n = Math.min(rows, H - r0);
        const top = r0 / ratio;
        const canvas = await toCanvas(world, {
          ...base,
          height: n / ratio,
          style: { transform: `translate(${-x0}px, ${-(y0 + top)}px)`, transformOrigin: "0 0" },
        });
        const ctx = canvas.getContext("2d")!;
        const sx = canvas.width / w;
        const sy = canvas.height / (n / ratio);
        for (const p of photos) {
          if (p.clip.y + p.clip.h < top || p.clip.y > top + n / ratio) continue;
          const bmp = await createImageBitmap(p.img, {
            resizeWidth: Math.max(1, Math.min(p.img.naturalWidth, Math.ceil(p.rect.w * ratio))),
            resizeHeight: Math.max(1, Math.min(p.img.naturalHeight, Math.ceil(p.rect.h * ratio))),
            resizeQuality: "high",
          }).catch(() => null);
          if (!bmp) continue;
          ctx.save();
          ctx.beginPath();
          ctx.rect(p.clip.x * sx, (p.clip.y - top) * sy, p.clip.w * sx, p.clip.h * sy);
          ctx.clip();
          ctx.imageSmoothingQuality = "high";
          try {
            ctx.drawImage(bmp, p.rect.x * sx, (p.rect.y - top) * sy, p.rect.w * sx, p.rect.h * sy);
          } catch {
            // image d'un autre site non autorisée : on garde le rendu normal
          }
          ctx.restore();
          bmp.close();
        }
        if (!jpeg) {
          single = canvas;
          break;
        }
        // Les lignes de la bande (la toile peut faire une ligne de moins à cause des arrondis).
        const got = Math.min(n, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, got).data;
        jpeg.addRows(data, canvas.width, got);
        if (got < n) for (let j = got; j < n; j++) jpeg.addRows(data.subarray((got - 1) * canvas.width * 4), canvas.width, 1);
        canvas.width = canvas.height = 0;
        await new Promise((r) => setTimeout(r, 0));
      }
      let blob: Blob | null;
      if (jpeg) {
        setCapturing("Capture : assemblage de l'image…");
        blob = jpeg.finish();
      } else {
        // Très grande capture : JPEG haute qualité, sinon le PNG pèserait des dizaines de Mo.
        const big = W * H > 30_000_000;
        blob = await new Promise<Blob | null>((r) => single!.toBlob(r, big ? "image/jpeg" : "image/png", 0.95));
        single!.width = single!.height = 0;
      }
      if (!blob) throw new Error("Image vide");
      const name = (document.title.split(/\s[—|-]\s/)[0] || "Tableau").replace(/[\\/:*?"<>|]+/g, " ").trim();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${name} - capture.${blob.type === "image/jpeg" ? "jpg" : "png"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      alert(`Capture impossible : ${e instanceof Error ? e.message : e}`);
    } finally {
      setCapturing(false);
    }
  };

  const menuEntries = (): MenuEntry[] => {
    if (!menu) return [];
    const ids = menuIds();
    const one = ids.length === 1 ? itemsRef.current[ids[0]] : null;
    const editableIds = ids.filter((id) => itemsRef.current[id] && canEdit(itemsRef.current[id]));
    const close = (fn: () => void) => () => {
      setMenu(null);
      fn();
    };
    if (!menu.target) {
      return [
        { label: "Coller ici", hint: "⌘V", hidden: !canAdd, run: close(() => void pasteFromMenu(menu.at)) },
        { sep: true },
        { label: "Nouvelle note ici", hidden: !canAdd, run: close(() => addNote(menu.at)) },
        { label: "Nouvelle liste ici", hidden: !canAdd, run: close(() => addTodo(menu.at)) },
        { sep: true },
        { label: "Tout sélectionner", hint: "⌘A", run: close(() => setGroup(Object.values(itemsRef.current).filter((i) => i.kind !== "arrow" && !i.parentId && canEdit(i)).map((i) => i.id))) },
        { label: "Tout voir", run: close(() => fit()) },
        { label: "Capture du tableau", run: close(() => void capture()) },
        { sep: true },
        { label: "Annuler", hint: "⌘Z", run: close(undo) },
        { label: "Rétablir", hint: "⇧⌘Z", run: close(redo) },
      ];
    }
    return [
      { label: "Ouvrir", hidden: one?.kind !== "board", run: close(() => one && openBoard(one)) },
      { label: "Ouvrir le lien", hidden: !(one?.kind === "link" && one.data.url), run: close(() => window.open(one!.data.url, "_blank", "noopener")) },
      { label: "Voir l'image en grand", hidden: !(one?.kind === "image" && one.src), run: close(() => window.open(one!.src!, "_blank", "noopener")) },
      { label: "Modifier", hidden: !one || one.kind === "arrow" || !canEdit(one), run: close(() => one && startEdit(one)) },
      { label: "Rogner l'image", hidden: !(one?.kind === "image" && one.src && canEdit(one)), run: close(() => one && setCropping(one.id)) },
      { label: "Redresser la flèche", hidden: !(one?.kind === "arrow" && one.data.bend && canEdit(one)), run: close(() => one && update(one.id, { data: { ...one.data, bend: undefined } })) },
      { sep: true },
      { label: "Copier", hint: "⌘C", run: close(() => void copySelection()) },
      {
        label: "Couper",
        hint: "⌘X",
        hidden: !editableIds.length,
        run: close(() => {
          if (!copySelection()) return;
          if (groupRef.current.length > 1) removeGroup(false);
          else remove(ids[0]);
        }),
      },
      { label: "Coller", hint: "⌘V", hidden: !canAdd, run: close(() => void pasteFromMenu({ x: menu.at.x + 20, y: menu.at.y + 20 })) },
      { label: "Dupliquer", hint: "⌘D", hidden: !canAdd, run: close(() => { const p = serializeSelection(); if (p) ensureName(() => pasteCards(p)); }) },
      { sep: true },
      { label: "Mettre au premier plan", hidden: !editableIds.length, run: close(() => restack(editableIds, true)) },
      { label: "Mettre à l'arrière-plan", hidden: !editableIds.length, run: close(() => restack(editableIds, false)) },
      { sep: true },
      {
        label: ids.length > 1 ? `Supprimer les ${ids.length} cartes` : "Supprimer",
        hint: "⌫",
        danger: true,
        hidden: !editableIds.length,
        run: close(() => (groupRef.current.length > 1 ? removeGroup() : remove(ids[0]))),
      },
    ];
  };
  type Tool = {
    label: string;
    Icon: typeof NoteIcon;
    run: () => void;
    /** Outil glissé puis lâché sur le tableau : création à cet endroit (ou dans la colonne visée). */
    drop?: (at: At, extra?: Extra) => void;
    admin?: boolean;
    /** Studio, ou client autorisé à tout modifier. */
    edit?: boolean;
    active?: boolean;
    desktop?: boolean;
  };
  const tools: Tool[] = [
    { label: "Note", Icon: NoteIcon, run: () => addNote(), drop: addNote },
    { label: "Lien", Icon: LinkIcon, run: () => addLink(), drop: (at, extra) => addLink("", at, extra) },
    {
      label: "Image",
      Icon: ImageIcon,
      run: () => ensureName(() => fileRef.current?.click()),
      drop: (at, extra) =>
        ensureName(() => {
          imageDrop.current = { at, extra };
          fileRef.current?.click();
        }),
    },
    { label: "Liste", Icon: ChecklistIcon, run: () => addTodo(), drop: addTodo },
    { label: "Tableau", Icon: TableIcon, run: () => addTable(), drop: addTable },
    { label: "Planche", Icon: BoardIcon, run: () => addBoard(), drop: addBoard, admin: true },
    { label: "Colonne", Icon: ColumnIcon, run: () => addColumn(), drop: (at) => addColumn(at), edit: true },
    { label: "Couleur", Icon: PaletteIcon, run: () => addColor(), drop: addColor, edit: true },
    { label: "Commentaire", Icon: CommentIcon, run: () => addComment(), drop: addComment },
    { label: "Flèche", Icon: ConnectorIcon, run: () => setArrowMode((m) => (m ? null : { from: null })), edit: true, active: Boolean(arrowMode) },
    { label: "Importer", Icon: ImportIcon, run: () => setImportOpen(true), admin: true, desktop: true },
  ];
  const visibleTools = tools.filter((t) => (!t.admin || role === "admin") && (!t.edit || role === "admin" || clientEditAll));

  /** Glisser un outil de la barre jusqu'au tableau (un simple clic marche toujours). */
  const startToolDrag = (e: React.PointerEvent, tool: Tool) => {
    if (!tool.drop || e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    const move = (ev: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 8) return;
        // Au doigt sur téléphone, un geste horizontal fait défiler la barre d'outils.
        if (ev.pointerType !== "mouse" && Math.abs(ev.clientX - startX) > Math.abs(ev.clientY - startY)) return cleanup();
        dragging = true;
      }
      setToolGhost({ label: tool.label, Icon: tool.Icon, x: ev.clientX, y: ev.clientY });
    };
    const up = (ev: PointerEvent) => {
      cleanup();
      if (!dragging) return;
      suppressToolClick.current = true;
      setToolGhost(null);
      const root = rootRef.current!;
      const o = root.getBoundingClientRect();
      const over = document.elementFromPoint(ev.clientX, ev.clientY);
      if (ev.clientX < o.left || ev.clientX > o.right || ev.clientY < o.top || ev.clientY > o.bottom || over?.closest("[data-ui]")) return;
      const v = viewRef.current;
      const at = { x: Math.round((ev.clientX - o.left - v.x) / v.k), y: Math.round((ev.clientY - o.top - v.y) / v.k) };
      // Lâché sur une colonne : la carte s'y range, à la fin (sauf colonne dans colonne).
      const col = tool.label === "Colonne" ? null : findDrop(ev.clientX, ev.clientY, "");
      if (col) {
        const kids = Object.values(itemsRef.current)
          .filter((c) => c.parentId === col.col)
          .sort((a, b) => a.position - b.position);
        const before = kids[col.index - 1];
        const after = kids[col.index];
        const position = before && after ? (before.position + after.position) / 2 : before ? before.position + 1 : after ? after.position - 1 : 0;
        tool.drop!(at, { parentId: col.col, position, w: itemsRef.current[col.col]?.w ?? 280 });
      } else tool.drop!(at);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    const cancel = () => {
      cleanup();
      setToolGhost(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };
  const v = view;
  const grid = 24 * v.k;

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-hidden touch-none select-none"
      style={{
        backgroundColor: "var(--bg-soft)",
        backgroundImage: v.k > 0.3 ? "radial-gradient(circle, var(--line) 1.1px, transparent 1.3px)" : undefined,
        backgroundSize: `${grid}px ${grid}px`,
        backgroundPosition: `${v.x}px ${v.y}px`,
      }}
      onPointerDown={onBackgroundDown}
      onContextMenu={openMenu}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-item], [data-ui]") || !canAdd) return;
        const o = rootRef.current!.getBoundingClientRect();
        addNote({ x: (e.clientX - o.left - v.x) / v.k, y: (e.clientY - o.top - v.y) / v.k });
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      // Le navigateur fait défiler la zone pour montrer un champ qui prend le focus : on l'annule,
      // le tableau se déplace uniquement par sa propre vue (sinon tout se décale).
      onScroll={(e) => {
        e.currentTarget.scrollTop = 0;
        e.currentTarget.scrollLeft = 0;
      }}
      data-tick={tick}
    >
      {/* Le tableau : coordonnées libres, déplacé et zoomé d'un bloc */}
      <div ref={worldRef} className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.k})` }}>
        <svg className="absolute left-0 top-0 overflow-visible pointer-events-none text-muted" width="1" height="1" style={{ zIndex: 0 }}>
          <defs>
            <marker id="board-arrow" viewBox="0 0 10 10" markerWidth="9" markerHeight="9" refX="8" refY="5" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
              <path d="M0,1 L9,5 L0,9 z" fill="currentColor" />
            </marker>
          </defs>
          {geom.arrows.map((a) => (
            <g key={a.id} className={selected === a.id ? "text-emerald-500" : ""}>
              <path
                d={a.d}
                stroke="transparent"
                strokeWidth={16}
                fill="none"
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelected(a.id);
                }}
              />
              <path d={a.d} stroke="currentColor" strokeWidth={selected === a.id ? 2.4 : 1.6} fill="none" markerEnd="url(#board-arrow)" />
            </g>
          ))}
        </svg>
        {topLevel.map((it) => renderCard(it))}
      </div>

      {/* Barre de la carte sélectionnée */}
      {sel && selEditable && !dragId && !arrowMode && (sel.kind === "arrow" ? geomArrow(sel.id) : geom.sel) && (
        <SelectionBar
          key={sel.id}
          pos={
            sel.kind === "arrow"
              ? { left: geomArrow(sel.id)!.mx * v.k + v.x, top: geomArrow(sel.id)!.my * v.k + v.y - 52 }
              : { left: geom.sel!.x * v.k + v.x + (geom.sel!.w * v.k) / 2, top: geom.sel!.y * v.k + v.y - 52 }
          }
          item={sel}
          onColor={sel.kind !== "arrow" ? (c) => applyColor([sel.id], c) : undefined}
          onInk={(ink) => applyInk([sel.id], ink)}
          onEdit={sel.kind !== "arrow" ? () => startEdit(sel) : undefined}
          onOpen={sel.kind === "board" ? () => openBoard(sel) : undefined}
          onIcon={sel.kind === "board" && role === "admin" ? (icon) => update(sel.id, { data: { ...sel.data, icon } }) : undefined}
          onFontSize={sel.kind !== "arrow" && sel.kind !== "image" ? (size) => applyFontSize([sel.id], size) : undefined}
          onCrop={sel.kind === "image" && sel.src ? () => setCropping(sel.id) : undefined}
          onDelete={() => remove(sel.id)}
        />
      )}

      {menu && <ContextMenu left={menu.left} top={menu.top} entries={menuEntries()} onClose={() => setMenu(null)} />}

      {/* Poignée de courbure de la flèche sélectionnée */}
      {sel?.kind === "arrow" && selEditable && !arrowMode && geomArrow(sel.id) && (
        <button
          data-ui
          aria-label="Courber la flèche"
          title="Glisser pour courber · double-clic pour redresser"
          onPointerDown={(e) => startBend(e, geomArrow(sel.id)!)}
          onDoubleClick={() => update(sel.id, { data: { ...sel.data, bend: undefined } })}
          className="absolute z-[200000] w-4 h-4 -ml-2 -mt-2 rounded-full bg-bg border-2 border-emerald-500 shadow cursor-grab touch-none"
          style={{ left: geomArrow(sel.id)!.mx * v.k + v.x, top: geomArrow(sel.id)!.my * v.k + v.y }}
        />
      )}

      {cropping && items[cropping]?.src && (
        <CropEditor
          item={items[cropping]}
          onCancel={() => setCropping(null)}
          onDone={(crop) => {
            const it = itemsRef.current[cropping];
            if (it) update(cropping, { data: { ...it.data, crop } });
            setCropping(null);
          }}
        />
      )}

      {capturing && (
        <div data-ui className="absolute inset-0 z-[300002] flex items-center justify-center bg-black/30 pointer-events-none">
          <p className="bg-bg text-sm px-4 py-2.5 rounded-full shadow-lg">{capturing}</p>
        </div>
      )}

      {/* Cadre de sélection (souris) */}
      {marquee && (
        <div
          className="absolute z-[200000] border border-emerald-500 bg-emerald-500/10 pointer-events-none"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          }}
        />
      )}

      {group.length > 1 && groupPalette && !marquee && (
        <div className="absolute z-[200001] top-16 left-1/2 -translate-x-1/2">
          <Palette current={{}} onColor={(c) => applyColor(groupRef.current, c)} onInk={(ink) => applyInk(groupRef.current, ink)} />
        </div>
      )}
      {/* Plusieurs cartes sélectionnées */}
      {group.length > 1 && !marquee && (
        <div data-ui className="absolute z-[200001] top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-bg border border-line shadow-lg rounded-full pl-4 pr-1.5 h-10 text-xs">
          <span>{group.length} cartes sélectionnées</span>
          <span className="text-muted hidden sm:inline">· glissez l&apos;une d&apos;elles pour tout déplacer</span>
          {group.some((id) => items[id] && items[id].kind !== "arrow") && (
            <button onClick={() => setGroupPalette((o) => !o)} className="ml-1 h-8 px-2 rounded-full text-muted hover:text-ink" title="Couleur de la sélection">
              Couleur
            </button>
          )}
          <button onClick={() => removeGroup()} className="ml-1 w-8 h-8 flex items-center justify-center text-muted hover:text-danger" aria-label="Supprimer la sélection" title="Supprimer">
            <TrashIcon className="w-4 h-4" />
          </button>
          <button onClick={() => setGroup([])} className="w-8 h-8 flex items-center justify-center text-muted hover:text-ink" aria-label="Désélectionner" title="Désélectionner">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Outils : à gauche sur ordinateur, en bas sur téléphone */}
      {canAdd && (
        <div
          data-ui
          style={{ touchAction: "pan-x" }}
          className="absolute z-[200000] bg-bg border border-line shadow-lg flex rounded-[4px] left-3 max-w-[calc(100%-76px)] overflow-x-auto no-scrollbar bottom-[max(env(safe-area-inset-bottom),12px)] sm:left-4 sm:top-4 sm:bottom-auto sm:flex-col sm:max-w-none sm:max-h-[calc(100%-32px)] sm:overflow-x-hidden sm:overflow-y-auto"
        >
          {visibleTools.map((tool) => {
            const { label, Icon, run, active, desktop } = tool;
            return (
            <button
              key={label}
              onPointerDown={(e) => startToolDrag(e, tool)}
              onClick={() => {
                if (suppressToolClick.current) {
                  suppressToolClick.current = false;
                  return;
                }
                run();
              }}
              title={tool.drop ? `${label} : cliquez, ou glissez sur le tableau` : desktop ? "Importer un tableau Milanote" : undefined}
              className={`${desktop ? "hidden sm:flex" : "flex"} shrink-0 flex-col items-center justify-center gap-1 w-[66px] h-[58px] text-[10px] transition-colors ${active ? "bg-emerald-500/15 text-emerald-600" : "text-muted hover:text-ink hover:bg-bg-soft"}`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
            );
          })}
        </div>
      )}

      {/* Outil en cours de glisser-déposer */}
      {toolGhost && (
        <div
          className="fixed z-[300000] pointer-events-none -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 w-[70px] py-2.5 bg-bg border-2 border-emerald-500 shadow-2xl rounded-[4px] text-[10px] text-ink"
          style={{ left: toolGhost.x, top: toolGhost.y }}
        >
          <toolGhost.Icon className="w-5 h-5" />
          {toolGhost.label}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          const target = fillTarget.current;
          fillTarget.current = null;
          if (target && files[0]) {
            e.target.value = "";
            void fillImage(target, files[0]);
            return;
          }
          const drop = imageDrop.current;
          imageDrop.current = null;
          e.target.value = "";
          if (!drop) addImages(files);
          // Outil Image lâché sur le tableau : les images arrivent à cet endroit (ou dans la colonne).
          else if (drop.extra?.parentId) {
            const col = drop.extra.parentId;
            const start = (drop.extra.position as number) ?? 0;
            void uploadImages(files, undefined, (i) => ({ parentId: col, position: start + i * 0.001, w: drop.extra?.w ?? 280 }));
          } else addImages(files, drop.at);
        }}
      />

      {arrowMode && (
        <div data-ui className="absolute z-[200000] top-4 left-1/2 -translate-x-1/2 bg-ink text-bg text-xs px-4 py-2.5 rounded-full flex items-center gap-3 shadow-lg">
          {arrowMode.from ? "Touchez la carte d'arrivée" : "Touchez la carte de départ"}
          <button onClick={() => setArrowMode(null)} aria-label="Annuler">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Zoom et état de l'enregistrement */}
      <div data-ui className="absolute z-[200000] right-3 bottom-[max(env(safe-area-inset-bottom),12px)] sm:bottom-4 sm:right-4 flex flex-col items-end gap-2">
        {(role === "admin" || canAdd) && (
          // Au téléphone : seulement en cas d'erreur (sinon ça gêne).
          <span className={`text-[11px] px-2 ${status.state === "error" ? "text-danger" : "text-muted hidden sm:inline"}`}>
            {status.state === "saving" ? "Enregistrement…" : status.state === "error" ? status.message : "Enregistré"}
          </span>
        )}
        {(role === "admin" || canAdd) && (
          <div className="hidden sm:flex bg-bg border border-line shadow-sm rounded-[4px] text-muted">
            <button
              className="w-10 h-10 flex items-center justify-center hover:text-ink disabled:opacity-30"
              onClick={undo}
              disabled={!history.current.length && !touched.current.size}
              aria-label="Annuler"
              title="Annuler (Cmd + Z)"
            >
              ↶
            </button>
            <button
              className="w-10 h-10 flex items-center justify-center hover:text-ink disabled:opacity-30 border-l border-line"
              onClick={redo}
              disabled={!future.current.length}
              aria-label="Rétablir"
              title="Rétablir (Cmd + Maj + Z)"
            >
              ↷
            </button>
          </div>
        )}
        <div className="flex sm:flex-row flex-col-reverse bg-bg border border-line shadow-sm rounded-[4px] text-muted">
          <button className="w-10 h-10 flex items-center justify-center hover:text-ink" onClick={() => zoomCenter(1 / 1.25)} aria-label="Dézoomer">
            <MinusIcon className="w-4 h-4" />
          </button>
          <button className="hidden sm:flex w-14 h-10 items-center justify-center text-[11px] hover:text-ink" onClick={() => zoomCenter(1 / v.k)} title="Taille réelle">
            {Math.round(v.k * 100)} %
          </button>
          <button className="w-10 h-10 flex items-center justify-center hover:text-ink" onClick={() => zoomCenter(1.25)} aria-label="Zoomer">
            <PlusIcon className="w-4 h-4" />
          </button>
          <button className="w-10 h-10 flex items-center justify-center hover:text-ink border-line sm:border-l border-b sm:border-b-0" onClick={fit} aria-label="Tout voir" title="Tout voir">
            <FitIcon className="w-4 h-4" />
          </button>
          <button
            className="w-10 h-10 flex items-center justify-center hover:text-ink border-line sm:border-l border-b sm:border-b-0 disabled:opacity-40"
            onClick={() => void capture()}
            disabled={Boolean(capturing)}
            aria-label="Capture du tableau"
            title="Capture du tableau (image en haute définition, nette au zoom)"
          >
            <CameraIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {Object.keys(items).length === 0 && canAdd && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-muted text-center max-w-xs px-6 leading-relaxed">
            Tableau vide. Ajoutez une note, une image ou une liste — ou glissez des photos ici.
            <span className="hidden sm:inline"> Double-clic n&apos;importe où pour écrire.</span>
          </p>
        </div>
      )}

      {importOpen && <ImportDialog onCancel={() => setImportOpen(false)} onFiles={(f) => void importMilanote(f)} />}
      {importing && (
        <div data-ui className="absolute z-[200000] top-4 left-1/2 -translate-x-1/2 bg-ink text-bg text-xs px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> {importing}
        </div>
      )}

      {askName && (
        <NameDialog
          endpoint={joinEndpoint!}
          onCancel={() => setAskName(null)}
          onDone={(n) => {
            setName(n);
            const action = askName;
            setAskName(null);
            // Le prénom doit être connu avant de créer la carte.
            setTimeout(action, 0);
          }}
        />
      )}
    </div>
  );

  function geomArrow(id: string) {
    return geom.arrows.find((a) => a.id === id) ?? null;
  }

  function zoomCenter(factor: number) {
    const r = rootRef.current!.getBoundingClientRect();
    zoomAt(factor, r.width / 2, r.height / 2);
  }
}

function NoteText({ text }: { text: string }) {
  if (!text) return <p className="text-muted">Note vide</p>;
  const [first, ...rest] = text.split("\n");
  return (
    <div className="whitespace-pre-wrap break-words">
      <p className={rest.length ? "font-medium" : ""}>
        <Linkified text={first} />
      </p>
      {rest.length > 0 && (
        <p>
          <Linkified text={rest.join("\n")} />
        </p>
      )}
    </div>
  );
}

function CropIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2.5V17a1 1 0 0 0 1 1h14.5M2.5 6H17a1 1 0 0 1 1 1v14.5" />
    </svg>
  );
}

type Crop = { x: number; y: number; w: number; h: number };
const CROP_RATIOS = [
  ["Libre", 0],
  ["1:1", 1],
  ["4:5", 4 / 5],
  ["3:2", 3 / 2],
  ["16:9", 16 / 9],
  ["9:16", 9 / 16],
] as const;

/**
 * Recadrage d'une image du tableau : on déplace et redimensionne le cadre (coins), formats photo au choix.
 * Rien n'est découpé dans le fichier : la carte n'affiche que la zone choisie, modifiable à tout moment.
 */
function CropEditor({ item, onCancel, onDone }: { item: BoardItem; onCancel: () => void; onDone: (crop: Crop | undefined) => void }) {
  const W = item.data.width ?? 4;
  const H = item.data.height ?? 3;
  const [crop, setCrop] = useState<Crop>(item.data.crop ?? { x: 0, y: 0, w: 1, h: 1 });
  const [ratio, setRatio] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  /** Plus grand cadre au format voulu, centré sur le cadre actuel. */
  const applyRatio = (r: number) => {
    setRatio(r);
    if (!r) return;
    let w = 1;
    let h = (W * w) / (H * r);
    if (h > 1) {
      h = 1;
      w = (H * h * r) / W;
    }
    const cx = crop.x + crop.w / 2;
    const cy = crop.y + crop.h / 2;
    setCrop({ x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h });
  };

  const drag = (e: React.PointerEvent, mode: "move" | "nw" | "ne" | "sw" | "se") => {
    e.preventDefault();
    e.stopPropagation();
    const rect = box.current!.getBoundingClientRect();
    const start = { px: e.clientX, py: e.clientY, ...crop };
    const min = 0.04;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.px) / rect.width;
      const dy = (ev.clientY - start.py) / rect.height;
      if (mode === "move") {
        setCrop({ ...crop, x: clamp(start.x + dx, 0, 1 - start.w), y: clamp(start.y + dy, 0, 1 - start.h), w: start.w, h: start.h });
        return;
      }
      const left = mode === "nw" || mode === "sw";
      const topSide = mode === "nw" || mode === "ne";
      let x0 = start.x;
      let y0 = start.y;
      let x1 = start.x + start.w;
      let y1 = start.y + start.h;
      if (left) x0 = clamp(x0 + dx, 0, x1 - min);
      else x1 = clamp(x1 + dx, x0 + min, 1);
      if (topSide) y0 = clamp(y0 + dy, 0, y1 - min);
      else y1 = clamp(y1 + dy, y0 + min, 1);
      if (ratio) {
        // Format imposé : la hauteur suit la largeur (et reste dans l'image).
        let w = x1 - x0;
        let h = (W * w) / (H * ratio);
        const maxH = topSide ? y1 : 1 - y0;
        if (h > maxH) {
          h = maxH;
          w = (H * h * ratio) / W;
          if (left) x0 = x1 - w;
          else x1 = x0 + w;
        }
        if (topSide) y0 = y1 - h;
        else y1 = y0 + h;
      }
      setCrop({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const pct = (n: number) => `${n * 100}%`;
  const corner = "absolute w-4 h-4 bg-white border border-black/40 rounded-full -ml-2 -mt-2 touch-none";
  return (
    <div
      data-ui
      className="absolute inset-0 z-[300000] flex flex-col items-center justify-center gap-4 bg-black/80 p-4"
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={box} className="relative select-none touch-none" style={{ aspectRatio: `${W} / ${H}`, width: `min(88vw, calc(70vh * ${W / H}))` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.src!} alt="" draggable={false} className="absolute inset-0 w-full h-full pointer-events-none" />
        {/* Hors du cadre : assombri */}
        <div
          className="absolute border border-white cursor-move"
          style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h), boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
          onPointerDown={(e) => drag(e, "move")}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(to right, transparent 33.2%, rgba(255,255,255,.35) 33.3%, transparent 33.5%, transparent 66.5%, rgba(255,255,255,.35) 66.6%, transparent 66.8%), linear-gradient(to bottom, transparent 33.2%, rgba(255,255,255,.35) 33.3%, transparent 33.5%, transparent 66.5%, rgba(255,255,255,.35) 66.6%, transparent 66.8%)" }} />
          <span className={`${corner} cursor-nwse-resize`} style={{ left: 0, top: 0 }} onPointerDown={(e) => drag(e, "nw")} />
          <span className={`${corner} cursor-nesw-resize`} style={{ left: "100%", top: 0 }} onPointerDown={(e) => drag(e, "ne")} />
          <span className={`${corner} cursor-nesw-resize`} style={{ left: 0, top: "100%" }} onPointerDown={(e) => drag(e, "sw")} />
          <span className={`${corner} cursor-nwse-resize`} style={{ left: "100%", top: "100%" }} onPointerDown={(e) => drag(e, "se")} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {CROP_RATIOS.map(([label, r]) => (
          <button
            key={label}
            onClick={() => applyRatio(r)}
            className={`h-8 px-3 rounded-full text-[12px] ${ratio === r ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onCancel} className="h-10 px-5 rounded-full bg-white/10 text-white text-[13px] hover:bg-white/20">
          Annuler
        </button>
        <button onClick={() => onDone(undefined)} className="h-10 px-5 rounded-full bg-white/10 text-white text-[13px] hover:bg-white/20">
          Image entière
        </button>
        <button onClick={() => onDone(crop.w > 0.999 && crop.h > 0.999 ? undefined : crop)} className="h-10 px-6 rounded-full bg-emerald-500 text-white text-[13px] font-medium">
          Rogner
        </button>
      </div>
    </div>
  );
}

type MenuEntry = { sep: true } | { sep?: false; label: string; hint?: string; danger?: boolean; hidden?: boolean; run: () => void };

/** Menu du clic droit (souris, trackpad à deux doigts, Ctrl + clic). Se ferme au clic ailleurs, à la molette ou avec Échap. */
function ContextMenu({ left, top, entries, onClose }: { left: number; top: number; entries: MenuEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left, top });
  // Pas de séparateur en double, ni au début ou à la fin, quand des options sont masquées.
  const shown = entries
    .filter((e) => e.sep || !e.hidden)
    .filter((e, i, arr) => !e.sep || (i > 0 && i < arr.length - 1 && !arr[i - 1].sep));
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement?.getBoundingClientRect();
    if (!el || !box) return;
    // Toujours entier à l'écran : ouvert vers la gauche / le haut près des bords.
    setPos({
      left: left + el.offsetWidth > box.width - 8 ? Math.max(8, left - el.offsetWidth) : left,
      top: top + el.offsetHeight > box.height - 8 ? Math.max(8, top - el.offsetHeight) : top,
    });
  }, [left, top]);
  useEffect(() => {
    const away = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("wheel", onClose, { passive: true });
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("wheel", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);
  if (!shown.length) return null;
  return (
    <div
      ref={ref}
      data-ui
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-[300001] min-w-[220px] bg-bg border border-line shadow-xl rounded-lg py-1.5 text-[13px] animate-[fadeIn_0.1s_ease-out_both]"
      style={pos}
    >
      {shown.map((e, i) =>
        e.sep ? (
          <div key={i} className="h-px bg-line my-1.5 mx-2" />
        ) : (
          <button
            key={i}
            role="menuitem"
            onClick={e.run}
            className={`w-full flex items-center justify-between gap-6 px-3.5 h-8 text-left hover:bg-bg-soft ${e.danger ? "text-danger" : "text-ink"}`}
          >
            {e.label}
            {e.hint && <span className="text-[11px] text-muted">{e.hint}</span>}
          </button>
        ),
      )}
    </div>
  );
}

function DropBar() {
  return <div className="h-[3px] rounded-full bg-emerald-500 -my-0.5" />;
}

function SelectionBar({
  pos,
  item,
  onColor,
  onInk,
  onEdit,
  onOpen,
  onIcon,
  onFontSize,
  onCrop,
  onDelete,
}: {
  pos: { left: number; top: number };
  item: BoardItem;
  onColor?: (c: ColorChoice) => void;
  onInk?: (ink: "auto" | "dark" | "light") => void;
  onEdit?: () => void;
  onOpen?: () => void;
  /** Planche (studio seulement) : choisir son pictogramme ; `undefined` = aperçu des images. */
  onIcon?: (icon: string | undefined) => void;
  onFontSize?: (size: number) => void;
  onCrop?: () => void;
  onDelete: () => void;
}) {
  const [palette, setPalette] = useState(false);
  const [icons, setIcons] = useState(false);
  const [sizes, setSizes] = useState(false);
  return (
    <div
      data-ui
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-[200001] -translate-x-1/2 flex flex-col items-center gap-1"
      // La palette est plus large que la barre : on la garde entière à l'écran.
      style={{
        left: Math.min(Math.max(pos.left, palette ? 330 : 130), (typeof window !== "undefined" ? window.innerWidth : 1200) - (palette ? 330 : 130)),
        top: Math.max(8, palette ? pos.top - 84 : icons || sizes ? pos.top - 52 : pos.top),
      }}
    >
      {icons && onIcon && (
        <div className="flex flex-wrap items-center justify-center gap-1 bg-bg border border-line shadow-lg rounded-2xl px-2 py-1.5 max-w-[92vw]">
          {Object.entries(BOARD_ICONS).map(([key, Icon]) => (
            <button
              key={key}
              onClick={() => onIcon(key)}
              aria-label={`Pictogramme ${key}`}
              className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-bg-soft ${item.data.icon === key ? "bg-bg-soft text-ink ring-2 ring-emerald-500" : "text-muted"}`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
          <span className="w-px h-5 bg-line mx-0.5" />
          <button
            onClick={() => onIcon(undefined)}
            className={`h-8 px-2.5 rounded-full text-[11px] hover:bg-bg-soft ${!item.data.icon ? "text-ink ring-2 ring-emerald-500" : "text-muted"}`}
            title="Afficher les images de la planche"
          >
            Images
          </button>
        </div>
      )}
      {palette && onColor && <Palette current={item.data} onColor={onColor} onInk={item.kind !== "color" ? onInk : undefined} />}
      {sizes && onFontSize && (
        <div className="flex items-center gap-1 bg-bg border border-line shadow-lg rounded-full px-1.5 h-10">
          {FONT_SIZES.map(([label, size]) => (
            <button
              key={label}
              onClick={() => onFontSize(size)}
              className={`h-7 px-2.5 rounded-full hover:bg-bg-soft ${(item.data.fontSize ?? 1) === size ? "bg-bg-soft text-ink ring-2 ring-emerald-500" : "text-muted"}`}
              style={{ fontSize: Math.round(9 + size * 3.5) }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 bg-bg border border-line shadow-lg rounded-full px-2 h-10">
        {onColor && (
          <button
            onClick={() => {
              setPalette((o) => !o);
              setIcons(false);
              setSizes(false);
            }}
            className="h-8 pl-1.5 pr-3 rounded-full flex items-center gap-2 text-[11px] text-muted hover:text-ink"
            title="Couleur"
          >
            <span className="w-5 h-5 rounded-full border border-line" style={{ background: noteBg(item.data.color, item.data.hex) }} />
            Couleur
          </button>
        )}
        {onColor && <span className="w-px h-5 bg-line mx-1" />}
        {onFontSize && (
          <button
            onClick={() => {
              setSizes((o) => !o);
              setPalette(false);
              setIcons(false);
            }}
            className={`w-8 h-8 flex items-center justify-center hover:text-ink font-serif ${sizes ? "text-ink" : "text-muted"}`}
            aria-label="Taille du texte"
            title="Taille du texte"
          >
            <span className="text-[11px]">A</span>
            <span className="text-[15px] -ml-px">A</span>
          </button>
        )}
        {onCrop && (
          <button onClick={onCrop} className="w-8 h-8 flex items-center justify-center text-muted hover:text-ink" aria-label="Rogner" title="Rogner l'image">
            <CropIcon className="w-4 h-4" />
          </button>
        )}
        {onIcon && (
          <button
            onClick={() => {
              setIcons((o) => !o);
              setPalette(false);
              setSizes(false);
            }}
            className="w-8 h-8 flex items-center justify-center text-muted hover:text-ink"
            aria-label="Pictogramme"
            title="Pictogramme"
          >
            {(() => {
              const Icon = BOARD_ICONS[item.data.icon ?? ""] ?? ImageIcon;
              return <Icon className="w-4 h-4" />;
            })()}
          </button>
        )}
      {onOpen && (
        <button onClick={onOpen} className="h-8 px-3 rounded-full bg-ink text-bg text-[11px] tracking-wider uppercase mr-1">
          Ouvrir
        </button>
      )}
      {onEdit && (
        <button onClick={onEdit} className="w-8 h-8 flex items-center justify-center text-muted hover:text-ink" aria-label="Modifier" title="Modifier">
          <PencilIcon className="w-4 h-4" />
        </button>
      )}
      <button onClick={onDelete} className="w-8 h-8 flex items-center justify-center text-muted hover:text-danger" aria-label="Supprimer" title="Supprimer">
        <TrashIcon className="w-4 h-4" />
      </button>
      </div>
    </div>
  );
}

/** Palette : teintes douces, couleurs pleines, et couleur libre. */
function Palette({
  current,
  onColor,
  onInk,
}: {
  current: BoardData;
  onColor: (c: ColorChoice) => void;
  onInk?: (ink: "auto" | "dark" | "light") => void;
}) {
  const ring = (on: boolean) => (on ? "ring-2 ring-offset-2 ring-offset-[var(--bg)] ring-emerald-500" : "");
  return (
    <div data-ui className="flex flex-wrap items-center justify-center gap-1.5 bg-bg border border-line shadow-lg rounded-2xl px-3 py-2 max-w-[92vw]">
      {(Object.keys(NOTE_COLORS) as NoteColor[]).map((c) => (
        <button
          key={c}
          onClick={() => onColor({ color: c })}
          title={c}
          aria-label={`Couleur ${c}`}
          className={`w-6 h-6 rounded-full border border-line ${ring(!current.hex && (current.color ?? "blanc") === c)}`}
          style={{ background: noteBg(c) }}
        />
      ))}
      <span className="w-px h-5 bg-line mx-0.5" />
      {SOLID_COLORS.map((hex) => (
        <button
          key={hex}
          onClick={() => onColor({ hex })}
          aria-label={`Couleur ${hex}`}
          className={`w-6 h-6 rounded-full ${ring(current.hex === hex)}`}
          style={{ background: hex }}
        />
      ))}
      <label
        title="Autre couleur"
        className={`relative w-6 h-6 rounded-full cursor-pointer overflow-hidden border border-line ${ring(Boolean(current.hex && !(SOLID_COLORS as readonly string[]).includes(current.hex)))}`}
        style={{ background: "conic-gradient(#e74c3c, #f1c40f, #2ecc71, #3498db, #9b59b6, #e74c3c)" }}
      >
        <input
          type="color"
          value={current.hex ?? "#d98b5f"}
          onChange={(e) => onColor({ hex: e.target.value })}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
      {onInk && (
        <div className="basis-full flex items-center justify-center gap-2 pt-1.5 mt-0.5 border-t border-line text-[11px]">
          <span className="text-muted">Texte</span>
          {(
            [
              ["auto", "Auto"],
              ["dark", "Noir"],
              ["light", "Blanc"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => onInk(k)}
              className={`h-6 px-2.5 rounded-full border ${(current.ink ?? "auto") === k ? "border-emerald-500 text-ink" : "border-line text-muted hover:text-ink"}`}
              style={k === "dark" ? { background: "#f3f1ed", color: "#1b1a19" } : k === "light" ? { background: "#1b1a19", color: "#fff" } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NameDialog({ endpoint, onDone, onCancel }: { endpoint: string; onDone: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: value }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(json.error || "Erreur");
    else onDone(json.name);
  }
  return (
    <div data-ui className="absolute inset-0 z-[300000] flex items-center justify-center bg-black/40 p-5" onPointerDown={(e) => e.stopPropagation()}>
      <form onSubmit={submit} className="w-full max-w-sm bg-bg border border-line p-7 shadow-2xl">
        <p className="display text-2xl">Votre prénom</p>
        <p className="text-sm text-muted mt-2 leading-relaxed">Vos idées seront signées avec, pour que le studio sache qui les a ajoutées.</p>
        <input autoFocus className="field mt-6 select-text" value={value} onChange={(e) => setValue(e.target.value)} maxLength={40} placeholder="Prénom" />
        {error && <p className="text-xs text-danger mt-2">{error}</p>}
        <div className="flex gap-3 mt-7">
          <button type="button" className="btn btn-ghost flex-1" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn flex-1" disabled={busy || !value.trim()}>
            Continuer
          </button>
        </div>
      </form>
    </div>
  );
}

function ImportDialog({ onFiles, onCancel }: { onFiles: (files: File[]) => void; onCancel: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div data-ui className="absolute inset-0 z-[300000] flex items-center justify-center bg-black/40 p-4" onPointerDown={(e) => e.stopPropagation()} onClick={onCancel}>
      <div className="w-full max-w-lg max-h-full overflow-y-auto bg-bg border border-line p-6 sm:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <p className="display text-2xl sm:text-3xl">Importer depuis Milanote</p>
          <button className="icon-btn -mr-2 -mt-1" onClick={onCancel} aria-label="Fermer">
            <CloseIcon />
          </button>
        </div>
        <ol className="mt-6 space-y-4 text-sm leading-relaxed">
          <li>
            <span className="font-medium">1. Le texte.</span> Dans Milanote, ouvrez le tableau, cliquez sur <b>Export</b> en haut à
            droite, puis <b>Markdown</b>. Un fichier <i>.md</i> se télécharge.
          </li>
          <li>
            <span className="font-medium">2. Les images.</span> Toujours dans <b>Export</b>, choisissez <b>Generate ZIP</b>. Milanote
            vous envoie un e-mail avec le lien : téléchargez le fichier <i>.zip</i>.
          </li>
          <li>
            <span className="font-medium">3.</span> Déposez les deux fichiers ci-dessous (ou l&apos;un des deux).
          </li>
        </ol>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOver(false);
            if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]);
          }}
          onClick={() => input.current?.click()}
          className={`mt-6 border border-dashed py-10 px-4 text-center cursor-pointer transition-colors ${over ? "border-emerald-500 bg-emerald-500/5" : "border-line hover:border-muted"}`}
        >
          <ImportIcon className="w-7 h-7 mx-auto text-muted" />
          <p className="text-sm mt-3">Déposez le .md et le .zip ici</p>
          <p className="text-xs text-muted mt-1">ou cliquez pour les choisir</p>
        </div>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept=".md,.markdown,.txt,.zip,image/*"
          onChange={(e) => e.target.files?.length && onFiles([...e.target.files])}
        />
        <p className="text-xs text-muted mt-5 leading-relaxed">
          Les titres deviennent des colonnes, les textes des notes, les cases à cocher des listes, et chaque dossier d&apos;images du
          ZIP une colonne. Milanote n&apos;exporte ni la position exacte des cartes ni les flèches : tout arrive rangé en colonnes, à
          droite de ce qui est déjà sur le tableau. Il ne reste qu&apos;à réorganiser.
        </p>
      </div>
    </div>
  );
}

/** Pastille de l'auteur d'un message : logo du studio, ou initiale du prénom du client. */
function Avatar({ name, studio }: { name: string; studio: boolean }) {
  if (studio) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/studio-icon.png" alt="ALVZ.REC" className="w-7 h-7 rounded-full shrink-0 object-cover bg-black" draggable={false} />;
  }
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-medium text-white" style={{ background: `hsl(${hue} 45% 45%)` }} title={name}>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** « à l'instant », « 14:32 » (aujourd'hui), sinon « 12 oct. ». */
function when(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "à l'instant";
  if (new Date().toDateString() === d.toDateString()) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Moteur de Safari : tous les navigateurs d'iPhone / iPad, et Safari sur Mac. */
function isWebKit() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|Android/.test(ua)) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
}

/**
 * Plus grande hauteur (en lignes, 16384 au plus) d'une toile de `width` pixels de large que ce navigateur
 * sait vraiment dessiner, sans dépasser `maxArea` pixels — 0 si même 64 lignes échouent.
 * On essaie pour de bon : la limite change selon l'appareil (iPhone ~16 Mpx, ordinateur bien plus).
 */
function maxCanvasRows(width: number, maxArea: number) {
  if (width > 16384) return 0;
  let rows = Math.min(16384, Math.floor(maxArea / width));
  while (rows >= 64) {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = rows;
    let ok = false;
    try {
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(width - 1, rows - 1, 1, 1);
        ok = ctx.getImageData(width - 1, rows - 1, 1, 1).data[3] === 255;
      }
    } catch {
      ok = false;
    }
    c.width = c.height = 0;
    if (ok) return rows;
    rows = Math.floor(rows * 0.75);
  }
  return 0;
}
