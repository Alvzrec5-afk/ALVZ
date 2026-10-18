"use client";

import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { addCollection, renameCollection, reorderCollections, setCover } from "@/app/admin/actions";
import type { Collection, PhotoView } from "@/lib/types";
import { CloseIcon, DotsIcon, HeartIcon, PlusCircleIcon } from "@/components/icons";
import { UploadPanel } from "./upload-panel";
import { AdminViewer } from "./admin-viewer";
import { purge } from "./purge";

type Props = {
  galleryId: string;
  coverPhotoId: string | null;
  collections: Collection[];
  photos: PhotoView[];
  positions: Record<string, number>;
  favoriteCounts: Record<string, number>;
};

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
  return json;
}

export function PhotosPanel(props: Props) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(props.collections[0]?.id ?? "");
  const active = props.collections.find((c) => c.id === activeId) ?? props.collections[0];
  const [order, setOrder] = useState<PhotoView[]>([]);
  const [positions, setPositions] = useState(props.positions);
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [actions, setActions] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const dragging = useRef(false); // évite d'ouvrir la visionneuse à la fin d'un glisser-déposer
  const [coverId, setCoverId] = useState(props.coverPhotoId);
  useEffect(() => setCoverId(props.coverPhotoId), [props.coverPhotoId]);

  useEffect(() => setPositions(props.positions), [props.positions]);
  useEffect(() => {
    setOrder(props.photos.filter((p) => p.collectionId === active?.id));
  }, [props.photos, active?.id]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    props.photos.forEach((p) => (c[p.collectionId] = (c[p.collectionId] ?? 0) + 1));
    return c;
  }, [props.photos]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
  );

  const endDrag = () => setTimeout(() => (dragging.current = false), 80);

  async function onDragEnd(e: DragEndEvent) {
    endDrag();
    if (!e.over || e.active.id === e.over.id) return;
    const from = order.findIndex((p) => p.id === e.active.id);
    const to = order.findIndex((p) => p.id === e.over!.id);
    const next = arrayMove(order, from, to);
    setOrder(next);
    // Nouvelle position = milieu entre les deux voisines : une seule mise à jour en base.
    const prev = next[to - 1] ? positions[next[to - 1].id] : undefined;
    const after = next[to + 1] ? positions[next[to + 1].id] : undefined;
    const position =
      prev !== undefined && after !== undefined ? (prev + after) / 2 : prev !== undefined ? prev + 1000 : (after ?? 0) - 1000;
    setPositions((p) => ({ ...p, [e.active.id as string]: position }));
    await post("/api/admin/photos/position", { photoId: e.active.id, position }).catch((err) => alert(err.message));
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const moveCollection = (dir: -1 | 1) =>
    run(async () => {
      const ids = props.collections.map((c) => c.id);
      const i = ids.indexOf(active.id);
      if (i + dir < 0 || i + dir >= ids.length) return;
      await reorderCollections(props.galleryId, arrayMove(ids, i, i + dir));
    });

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="display text-2xl sm:text-3xl min-w-0 truncate">{active?.name ?? "Photos"}</h2>
        <button onClick={() => setUploadOpen((o) => !o)} className="shrink-0 flex items-center gap-1.5 text-[13px] sm:text-sm text-accent hover:opacity-80">
          <PlusCircleIcon /> Ajouter des médias
        </button>
      </div>
      {/* Fenêtre d'envoi : reste montée quand elle est fermée, pour ne pas interrompre un envoi en cours */}
      <div className={uploadOpen ? "fixed inset-0 z-50 flex items-end sm:items-center justify-center" : "hidden"}>
        <div className="absolute inset-0 bg-black/60" onClick={() => setUploadOpen(false)} />
        <div className="relative w-full sm:max-w-2xl max-h-[90svh] overflow-y-auto bg-bg border-t sm:border border-line px-5 pt-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] animate-[fadeUp_0.3s_ease-out_both]">
          <div className="flex items-center justify-between mb-4">
            <p className="eyebrow text-muted">Ajouter des médias</p>
            <button className="icon-btn -mr-2" onClick={() => setUploadOpen(false)} aria-label="Fermer">
              <CloseIcon />
            </button>
          </div>
          <UploadPanel galleryId={props.galleryId} defaultCollection={active?.name ?? "Galerie"} />
          <p className="text-xs text-muted -mt-6">Vous pouvez fermer cette fenêtre : l&apos;envoi continue en arrière-plan.</p>
        </div>
      </div>

      <div className="flex items-center border-b border-line mb-5">
      <div className="flex-1 min-w-0 flex items-center gap-6 overflow-x-auto no-scrollbar">
        {props.collections.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveId(c.id)}
            className={`eyebrow py-3 -mb-px border-b whitespace-nowrap transition-colors ${c.id === active?.id ? "border-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {c.name} <span className="text-muted ml-1">{counts[c.id] ?? 0}</span>
          </button>
        ))}
        <button
          className="eyebrow py-3 text-muted hover:text-ink whitespace-nowrap"
          onClick={() => {
            const name = prompt("Nom de la nouvelle collection (ex : Cérémonie)");
            if (name) run(async () => {
              const r = await addCollection(props.galleryId, name);
              if (r.error) throw new Error(r.error);
            });
          }}
        >
          + Collection
        </button>
      </div>
      {active && (
        <div className="shrink-0 pl-2">
          <div className="relative">
            <button className="icon-btn -mr-2" onClick={() => setActions((a) => !a)} aria-label="Actions de la collection" disabled={busy}>
              <DotsIcon />
            </button>
            {actions && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setActions(false)} />
                <div className="absolute right-0 mt-1 z-20 w-64 bg-bg-soft border border-line py-1 shadow-xl text-sm" onClick={() => setActions(false)}>
                  <button
                    className="block w-full text-left px-4 py-3 hover:bg-bg"
                    onClick={() => {
                      const name = prompt("Nom de la nouvelle collection (ex : Cérémonie)");
                      if (name) run(async () => {
                        const r = await addCollection(props.galleryId, name);
                        if (r.error) throw new Error(r.error);
                      });
                    }}
                  >
                    Nouvelle collection
                  </button>
                  <button className="block w-full text-left px-4 py-3 hover:bg-bg" onClick={() => run(() => post("/api/admin/photos/sort-by-date", { collectionId: active.id }))}>
                    Trier par date de prise de vue
                  </button>
                  <button
                    className="block w-full text-left px-4 py-3 hover:bg-bg"
                    onClick={() => {
                      const name = prompt("Nouveau nom", active.name);
                      if (name && name !== active.name) run(async () => {
                        const r = await renameCollection(props.galleryId, active.id, name);
                        if (r.error) throw new Error(r.error);
                      });
                    }}
                  >
                    Renommer la collection
                  </button>
                  {props.collections.length > 1 && (
                    <>
                      <button className="block w-full text-left px-4 py-3 hover:bg-bg" onClick={() => moveCollection(-1)}>Déplacer vers la gauche</button>
                      <button className="block w-full text-left px-4 py-3 hover:bg-bg" onClick={() => moveCollection(1)}>Déplacer vers la droite</button>
                    </>
                  )}
                  <button
                    className="block w-full text-left px-4 py-3 text-danger hover:bg-bg"
                    onClick={() => {
                      if (confirm(`Supprimer la collection « ${active.name} » et ses ${counts[active.id] ?? 0} photos ?`)) {
                        run(() => purge("collection", active.id));
                      }
                    }}
                  >
                    Supprimer la collection
                  </button>
                  <p className="px-4 pt-2 pb-2 text-[11px] text-muted border-t border-line mt-1">Astuce : maintenez une photo puis glissez-la pour la déplacer.</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </div>

      {order.length === 0 ? (
        <button onClick={() => setUploadOpen(true)} className="w-full py-16 text-center text-sm text-muted border border-dashed border-line hover:border-muted">
          Aucune photo dans cette collection.<br />
          <span className="text-accent">Touchez ici pour ajouter des photos</span>
        </button>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => (dragging.current = true)} onDragCancel={endDrag} onDragEnd={onDragEnd}>
          <SortableContext items={order.map((p) => p.id)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {order.map((p) => (
                <SortablePhoto
                  key={p.id}
                  photo={p}
                  isCover={p.id === coverId}
                  onOpen={() => !dragging.current && setViewer(order.findIndex((o) => o.id === p.id))}
                  favorites={props.favoriteCounts[p.id] ?? 0}
                  onCover={() => run(() => setCover(props.galleryId, p.id))}
                  onDelete={() => {
                    if (confirm(`Supprimer ${p.filename} ?`)) run(() => post("/api/admin/photos/delete", { photoIds: [p.id] }));
                  }}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {viewer !== null && order[viewer] && (
        <AdminViewer
          photos={order}
          index={viewer}
          onIndex={setViewer}
          onClose={() => setViewer(null)}
          coverId={coverId}
          favoriteCounts={props.favoriteCounts}
          onCover={async (p) => {
            await setCover(props.galleryId, p.id);
            setCoverId(p.id);
            router.refresh();
          }}
          onDelete={async (p) => {
            try {
              await post("/api/admin/photos/delete", { photoIds: [p.id] });
            } catch (e) {
              alert(e instanceof Error ? e.message : String(e));
              return;
            }
            const remaining = order.filter((o) => o.id !== p.id);
            setOrder(remaining);
            if (remaining.length === 0) setViewer(null);
            else setViewer(Math.min(viewer, remaining.length - 1));
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function SortablePhoto({
  photo,
  isCover,
  onOpen,
  favorites,
  onCover,
  onDelete,
}: {
  photo: PhotoView;
  isCover: boolean;
  onOpen: () => void;
  favorites: number;
  onCover: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`group relative aspect-square bg-bg-soft touch-manipulation cursor-pointer ${isDragging ? "opacity-70" : ""}`}
      {...attributes}
      {...listeners}
      onClick={onOpen}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.thumb} alt={photo.filename} loading="lazy" draggable={false} className="w-full h-full object-cover" />
      {isCover && <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] tracking-widest uppercase px-1.5 py-0.5">Couverture</span>}
      {favorites > 0 && (
        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-white text-[11px] drop-shadow">
          <HeartIcon className="w-3.5 h-3.5" filled /> {favorites}
        </span>
      )}
      <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isCover && (
          <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onCover(); }} className="bg-black/60 text-white text-[10px] px-1.5 py-1 uppercase tracking-wider" title="Utiliser comme couverture">
            Couv.
          </button>
        )}
        <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(); }} className="bg-black/60 text-white text-[10px] px-1.5 py-1" title="Supprimer">
          ✕
        </button>
      </div>
      <p className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-[10px] text-white bg-gradient-to-t from-black/60 to-transparent truncate opacity-0 group-hover:opacity-100 transition-opacity text-right">
        {photo.filename}
      </p>
    </li>
  );
}
