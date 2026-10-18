"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_WIDTH,
  MAX_WIDTH,
  MIN_WIDTH,
  NOTE_COLORS,
  type BoardData,
  type BoardItem,
  type BoardItemInput,
  type BoardKind,
  type NoteColor,
} from "@/lib/board-types";
import { makeBoardImage } from "@/lib/client/image";
import {
  ChecklistIcon,
  CloseIcon,
  ColumnIcon,
  ConnectorIcon,
  FitIcon,
  ImageIcon,
  MinusIcon,
  NoteIcon,
  PencilIcon,
  PlusIcon,
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
});

const noteBg = (color: NoteColor | undefined) =>
  !color || color === "blanc" ? "var(--bg)" : `color-mix(in srgb, ${NOTE_COLORS[color]} 30%, var(--bg))`;

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
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  onDone: () => void;
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
    el.focus();
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

export function BoardCanvas({ initialItems, endpoint, imageEndpoint, role, canAdd, visitorName, joinEndpoint }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItemsState] = useState<Items>(() => Object.fromEntries(initialItems.map((i) => [i.id, i])));
  const itemsRef = useRef(items);
  const [view, setViewState] = useState<View>({ x: 60, y: 60, k: 1 });
  const viewRef = useRef(view);
  const [selected, setSelected] = useState<string | null>(null);
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

  const canEdit = useCallback((it: BoardItem) => role === "admin" || it.mine, [role]);

  // ——— Modifications ———

  const persist = useCallback(
    (it: BoardItem) => {
      if (uploading.current.has(it.id)) return; // enregistrée à la fin de l'envoi de l'image
      sync.push({ op: "put", item: toInput(it) });
    },
    [sync],
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
      // Une colonne supprimée libère ses cartes sur le tableau, à leur place.
      for (const child of Object.values(all).filter((c) => c.parentId === id)) {
        const b = boxOf(child.id);
        all[child.id] = { ...child, parentId: null, x: b?.x ?? it.x, y: b?.y ?? it.y, w: it.w };
        sync.push({ op: "put", item: toInput(all[child.id]) });
      }
      const gone = [id];
      if (role === "admin") {
        for (const a of Object.values(all)) if (a.kind === "arrow" && (a.data.from === id || a.data.to === id)) gone.push(a.id);
      }
      for (const g of gone) {
        delete all[g];
        sync.push({ op: "delete", id: g });
      }
      setItems(all);
      setSelected(null);
      setEditing(null);
    },
    [boxOf, canEdit, role, setItems, sync],
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
    [persist, role, setItems],
  );

  const addNote = (at?: { x: number; y: number }) =>
    ensureName(() => {
      const it = create("note", { text: "", color: "blanc" }, at);
      setEditing({ id: it.id });
    });
  const addTodo = () =>
    ensureName(() => {
      const it = create("todo", { title: "", items: [{ id: crypto.randomUUID(), text: "", done: false }] });
      setEditing({ id: it.id, field: "title" });
    });
  const addColumn = () => {
    const it = create("column", { title: "", color: "blanc" });
    setEditing({ id: it.id, field: "title" });
  };

  const addImages = useCallback(
    (files: File[], at?: { x: number; y: number }) =>
      ensureName(async () => {
        const images = files.filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|avif|gif)$/i.test(f.name));
        for (const [i, file] of images.entries()) {
          const pos = at ? { x: at.x + i * 30, y: at.y + i * 30 } : undefined;
          let prepared: Awaited<ReturnType<typeof makeBoardImage>>;
          try {
            prepared = await makeBoardImage(file);
          } catch (e) {
            alert(`${file.name} : ${e instanceof Error ? e.message : e}`);
            continue;
          }
          const id = crypto.randomUUID();
          uploading.current.add(id);
          const it = create("image", { caption: "", width: prepared.width, height: prepared.height }, pos, {
            id,
            src: URL.createObjectURL(prepared.blob),
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
            if (latest) sync.push({ op: "put", item: { ...toInput(latest), sizeBytes: prepared.blob.size } });
          } catch (e) {
            uploading.current.delete(id);
            const all = { ...itemsRef.current };
            delete all[id];
            setItems(all);
            alert(`Image non envoyée : ${e instanceof Error ? e.message : e}`);
          }
        }
      }),
    [create, ensureName, imageEndpoint, role, setItems, sync],
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
    if (e.button !== 0) return;
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
    if (!canEdit(it)) return; // carte du studio côté client : le geste déplace le tableau
    e.stopPropagation();
    if (editing?.id !== it.id) setEditing(null);
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
  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  const onBackgroundDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-ui], input, textarea, button, a, [data-nodrag]")) return;
    lastActivity.current = Date.now();
    if (arrowMode && e.pointerType === "mouse") setArrowMode(null);
    setSelected(null);
    setEditing(null);
    const root = rootRef.current!;
    const o = root.getBoundingClientRect();
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

  const [geom, setGeom] = useState<{ arrows: { id: string; d: string; mx: number; my: number }[]; sel: Box | null }>({ arrows: [], sel: null });
  useLayoutEffect(() => {
    const next = {
      arrows: arrows.flatMap((a) => {
        const A = a.data.from ? boxOf(a.data.from) : null;
        const B = a.data.to ? boxOf(a.data.to) : null;
        if (!A || !B) return [];
        const p = edgePoint(A, B.x + B.w / 2, B.y + B.h / 2, 6);
        const q = edgePoint(B, A.x + A.w / 2, A.y + A.h / 2, 8);
        return [{ id: a.id, d: `M${p.x.toFixed(1)},${p.y.toFixed(1)} L${q.x.toFixed(1)},${q.y.toFixed(1)}`, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2 }];
      }),
      sel: selected && items[selected] && items[selected].kind !== "arrow" ? boxOf(selected) : null,
    };
    if (JSON.stringify(next) !== JSON.stringify(geom)) setGeom(next);
  });

  // ——— Clavier, coller, fichiers glissés ———

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea")) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        remove(selected);
      } else if (e.key === "Escape") {
        setSelected(null);
        setArrowMode(null);
      }
    };
    const paste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.("input, textarea") || !canAdd) return;
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) {
        e.preventDefault();
        addImages(files);
        return;
      }
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (text) {
        e.preventDefault();
        ensureName(() => create("note", { text: text.slice(0, 5000), color: "blanc" }));
      }
    };
    window.addEventListener("keydown", key);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("paste", paste);
    };
  }, [addImages, canAdd, create, ensureName, remove, selected]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canAdd) return;
    const files = [...e.dataTransfer.files];
    if (!files.length) return;
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
  };

  const startEdit = (it: BoardItem) => {
    if (!canEdit(it)) return;
    setSelected(it.id);
    setEditing({ id: it.id, field: it.kind === "todo" || it.kind === "column" ? "title" : it.kind === "image" ? "caption" : undefined });
  };

  function renderCard(it: BoardItem, inColumn = false) {
    const editable = canEdit(it);
    const isSel = selected === it.id;
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
          background: it.kind === "column" ? "color-mix(in srgb, var(--ink) 4%, var(--bg-soft))" : it.kind === "note" ? noteBg(it.data.color) : "var(--bg)",
          outline: isSel || firstPick ? "2px solid #10b981" : undefined,
          outlineOffset: 1,
        }}
        className={`rounded-[3px] text-[13px] leading-relaxed select-none ${inColumn ? "relative" : ""} ${shell} ${pickable} ${editable && !arrowMode ? "cursor-grab active:cursor-grabbing" : ""}`}
        onPointerDown={(e) => startDrag(e, it)}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest("input, textarea, button, a")) return;
          e.stopPropagation();
          if (it.kind !== "column" || (e.target as HTMLElement).closest("[data-col-head]")) startEdit(it);
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
              <img
                src={it.src}
                alt={it.data.caption || ""}
                draggable={false}
                onLoad={() => setTick((t) => t + 1)}
                className="block w-full h-auto pointer-events-none"
                style={{ aspectRatio: `${it.data.width ?? 4} / ${it.data.height ?? 3}` }}
              />
            ) : (
              <div className="w-full bg-bg-soft flex items-center justify-center text-muted" style={{ aspectRatio: `${it.data.width ?? 4} / ${it.data.height ?? 3}` }}>
                <ImageIcon className="w-6 h-6" />
              </div>
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

        {it.kind === "column" && (
          <div>
            <div data-col-head className="flex items-baseline gap-2 px-1 pb-2.5 pt-0.5">
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

  function renderTodo(it: BoardItem, editable: boolean, ed: Editing) {
    const entries = it.data.items ?? [];
    const done = entries.filter((e) => e.done).length;
    const setEntries = (next: typeof entries) => updateData(it.id, { items: next });
    const addAfter = (index: number) => {
      const entry = { id: crypto.randomUUID(), text: "", done: false };
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
            <li key={entry.id} className="group/entry flex items-start gap-2">
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
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAfter(i);
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
  const tools: { label: string; Icon: typeof NoteIcon; run: () => void; admin?: boolean; active?: boolean }[] = [
    { label: "Note", Icon: NoteIcon, run: () => addNote() },
    { label: "Image", Icon: ImageIcon, run: () => ensureName(() => fileRef.current?.click()) },
    { label: "Liste", Icon: ChecklistIcon, run: addTodo },
    { label: "Colonne", Icon: ColumnIcon, run: addColumn, admin: true },
    { label: "Flèche", Icon: ConnectorIcon, run: () => setArrowMode((m) => (m ? null : { from: null })), admin: true, active: Boolean(arrowMode) },
  ];
  const visibleTools = tools.filter((t) => !t.admin || role === "admin");
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
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-item], [data-ui]") || !canAdd) return;
        const o = rootRef.current!.getBoundingClientRect();
        addNote({ x: (e.clientX - o.left - v.x) / v.k, y: (e.clientY - o.top - v.y) / v.k });
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      data-tick={tick}
    >
      {/* Le tableau : coordonnées libres, déplacé et zoomé d'un bloc */}
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.k})` }}>
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
          pos={
            sel.kind === "arrow"
              ? { left: geomArrow(sel.id)!.mx * v.k + v.x, top: geomArrow(sel.id)!.my * v.k + v.y - 52 }
              : { left: geom.sel!.x * v.k + v.x + (geom.sel!.w * v.k) / 2, top: geom.sel!.y * v.k + v.y - 52 }
          }
          item={sel}
          onColor={sel.kind === "note" || sel.kind === "column" ? (color) => updateData(sel.id, { color }) : undefined}
          onEdit={sel.kind !== "arrow" ? () => startEdit(sel) : undefined}
          onDelete={() => remove(sel.id)}
        />
      )}

      {/* Outils : à gauche sur ordinateur, en bas sur téléphone */}
      {canAdd && (
        <div
          data-ui
          className="absolute z-[200000] bg-bg border border-line shadow-lg flex rounded-[4px] left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),12px)] sm:left-4 sm:translate-x-0 sm:top-4 sm:bottom-auto sm:flex-col"
        >
          {visibleTools.map(({ label, Icon, run, active }) => (
            <button
              key={label}
              onClick={run}
              className={`flex flex-col items-center justify-center gap-1 w-[60px] h-[58px] text-[10px] tracking-wide transition-colors ${active ? "bg-emerald-500/15 text-emerald-600" : "text-muted hover:text-ink hover:bg-bg-soft"}`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addImages([...(e.target.files ?? [])]);
          e.target.value = "";
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
          <span className={`text-[11px] px-2 ${status.state === "error" ? "text-danger" : "text-muted"}`}>
            {status.state === "saving" ? "Enregistrement…" : status.state === "error" ? status.message : "Enregistré"}
          </span>
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

function DropBar() {
  return <div className="h-[3px] rounded-full bg-emerald-500 -my-0.5" />;
}

function SelectionBar({
  pos,
  item,
  onColor,
  onEdit,
  onDelete,
}: {
  pos: { left: number; top: number };
  item: BoardItem;
  onColor?: (c: NoteColor) => void;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      data-ui
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-[200001] -translate-x-1/2 flex items-center gap-1 bg-bg border border-line shadow-lg rounded-full px-2 h-10"
      style={{ left: pos.left, top: Math.max(8, pos.top) }}
    >
      {onColor &&
        (Object.keys(NOTE_COLORS) as NoteColor[]).map((c) => (
          <button
            key={c}
            onClick={() => onColor(c)}
            title={c}
            aria-label={`Couleur ${c}`}
            className={`w-5 h-5 rounded-full border ${(item.data.color ?? "blanc") === c ? "border-ink border-2" : "border-line"}`}
            style={{ background: noteBg(c) }}
          />
        ))}
      {onColor && <span className="w-px h-5 bg-line mx-1" />}
      {onEdit && (
        <button onClick={onEdit} className="w-8 h-8 flex items-center justify-center text-muted hover:text-ink" aria-label="Modifier" title="Modifier">
          <PencilIcon className="w-4 h-4" />
        </button>
      )}
      <button onClick={onDelete} className="w-8 h-8 flex items-center justify-center text-muted hover:text-danger" aria-label="Supprimer" title="Supprimer">
        <TrashIcon className="w-4 h-4" />
      </button>
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
