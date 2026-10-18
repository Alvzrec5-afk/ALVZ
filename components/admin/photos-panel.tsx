"use client";

import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { setCover } from "@/app/admin/actions";
import type { Collection, PhotoView } from "@/lib/types";
import { CloseIcon, DotsIcon, GridIcon, HeartIcon, PlusCircleIcon, SortIcon } from "@/components/icons";
import { UploadPanel } from "./upload-panel";
import { deleteInBackground } from "./background";
import { AdminViewer } from "./admin-viewer";
import { CollectionMenu, post, promptNewCollection, useRun } from "./collection-menu";

type Props = {
  galleryId: string;
  coverPhotoId: string | null;
  collections: Collection[];
  photos: PhotoView[];
  positions: Record<string, number>;
  favoriteCounts: Record<string, number>;
  downloadCounts: Record<string, number>;
  activeId: string;
  onActive: (id: string) => void;
};

export function PhotosPanel(props: Props) {
  const router = useRouter();
  const { activeId, onActive: setActiveId } = props;
  const active = props.collections.find((c) => c.id === activeId) ?? props.collections[0];
  const [order, setOrder] = useState<PhotoView[]>([]);
  const [positions, setPositions] = useState(props.positions);
  const { busy, run } = useRun();
  const [large, setLarge] = useState(true); // taille des vignettes sur ordinateur
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

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 lg:mb-8">
        <h2 className="display text-2xl sm:text-3xl min-w-0 truncate">{active?.name ?? "Photos"}</h2>
        <div className="shrink-0 flex items-center gap-1">
          {active && (
            <span className="hidden lg:contents">
              <button
                className="w-10 h-10 flex items-center justify-center text-muted hover:text-ink"
                title="Trier par date de prise de vue"
                aria-label="Trier par date de prise de vue"
                disabled={busy}
                onClick={() => run(() => post("/api/admin/photos/sort-by-date", { collectionId: active.id }))}
              >
                <SortIcon />
              </button>
              <button
                className="w-10 h-10 flex items-center justify-center text-muted hover:text-ink"
                title={large ? "Petites vignettes" : "Grandes vignettes"}
                aria-label="Taille des vignettes"
                onClick={() => setLarge((l) => !l)}
              >
                <GridIcon />
              </button>
              <span className="w-px h-6 bg-line mx-3" />
            </span>
          )}
          <button onClick={() => setUploadOpen((o) => !o)} className="flex items-center gap-1.5 text-[13px] sm:text-sm text-accent hover:opacity-80">
            <PlusCircleIcon /> Ajouter des médias
          </button>
        </div>
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

      <div className="flex items-center border-b border-line mb-5 lg:hidden">
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
        <button className="eyebrow py-3 text-muted hover:text-ink whitespace-nowrap" onClick={() => promptNewCollection(props.galleryId, run)}>
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
              <CollectionMenu
                galleryId={props.galleryId}
                collection={active}
                collections={props.collections}
                count={counts[active.id] ?? 0}
                run={run}
                onClose={() => setActions(false)}
              />
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
        <DndContext id="photos" sensors={sensors} collisionDetection={closestCenter} onDragStart={() => (dragging.current = true)} onDragCancel={endDrag} onDragEnd={onDragEnd}>
          <SortableContext items={order.map((p) => p.id)} strategy={rectSortingStrategy}>
            <ul className={`grid grid-cols-3 sm:grid-cols-4 gap-2 ${large ? "lg:grid-cols-4 xl:grid-cols-5 lg:gap-6" : "lg:grid-cols-6 xl:grid-cols-8 lg:gap-3"}`}>
              {order.map((p) => (
                <SortablePhoto
                  key={p.id}
                  photo={p}
                  isCover={p.id === coverId}
                  onOpen={() => !dragging.current && setViewer(order.findIndex((o) => o.id === p.id))}
                  favorites={props.favoriteCounts[p.id] ?? 0}
                  downloads={props.downloadCounts[p.id] ?? 0}
                  onCover={() => run(() => setCover(props.galleryId, p.id))}
                  onDelete={() => {
                    if (confirm(`Supprimer ${p.filename} ?`)) {
                      deleteInBackground([p.id], () => post("/api/admin/photos/delete", { photoIds: [p.id] }), () => router.refresh());
                    }
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
          downloadCounts={props.downloadCounts}
          onCover={async (p) => {
            await setCover(props.galleryId, p.id);
            setCoverId(p.id);
            router.refresh();
          }}
          onDelete={async (p) => {
            // La photo disparaît tout de suite ; suppression des fichiers en arrière-plan.
            deleteInBackground([p.id], () => post("/api/admin/photos/delete", { photoIds: [p.id] }), () => router.refresh());
            const remaining = order.filter((o) => o.id !== p.id);
            setOrder(remaining);
            if (remaining.length === 0) setViewer(null);
            else setViewer(Math.min(viewer, remaining.length - 1));
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
  downloads,
  onCover,
  onDelete,
}: {
  photo: PhotoView;
  isCover: boolean;
  onOpen: () => void;
  favorites: number;
  downloads: number;
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
      <img src={photo.thumb} alt={photo.filename} loading="lazy" draggable={false} className="w-full h-full object-cover lg:object-contain lg:p-[7%]" />
      {isCover && <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] tracking-widest uppercase px-1.5 py-0.5">Couverture</span>}
      {(favorites > 0 || downloads > 0) && (
        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-2 text-white text-[11px] drop-shadow">
          {favorites > 0 && (
            <span className="flex items-center gap-1">
              <HeartIcon className="w-3.5 h-3.5" filled /> {favorites}
            </span>
          )}
          {downloads > 0 && <span>↓ {downloads}</span>}
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
