"use client";

import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";
import { reorderCollections } from "@/app/admin/actions";
import type { Collection } from "@/lib/types";
import { DotsIcon, DragIcon, PlusCircleIcon } from "@/components/icons";
import { CollectionMenu, promptNewCollection, useRun } from "./collection-menu";

/** Colonne de gauche (ordinateur) : liste des collections, glisser-déposer pour les ordonner. */
export function CollectionsSidebar({
  galleryId,
  collections,
  counts,
  activeId,
  onActive,
}: {
  galleryId: string;
  collections: Collection[];
  counts: Record<string, number>;
  activeId: string;
  onActive: (id: string) => void;
}) {
  const { busy, run } = useRun();
  const [items, setItems] = useState(collections);
  const [menu, setMenu] = useState<string | null>(null);
  useEffect(() => setItems(collections), [collections]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const next = arrayMove(
      items,
      items.findIndex((c) => c.id === e.active.id),
      items.findIndex((c) => c.id === e.over!.id),
    );
    setItems(next);
    run(() => reorderCollections(galleryId, next.map((c) => c.id)));
  }

  return (
    <div className={busy ? "opacity-60" : ""}>
      <div className="flex items-center justify-between px-6 h-14">
        <span className="eyebrow text-muted">Photos</span>
        <button className="flex items-center gap-1.5 text-sm text-accent hover:opacity-80" onClick={() => promptNewCollection(galleryId, run)}>
          <PlusCircleIcon className="w-4 h-4" /> Ajouter une collection
        </button>
      </div>
      <DndContext id="collections" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul>
            {items.map((c) => (
              <Row
                key={c.id}
                collection={c}
                count={counts[c.id] ?? 0}
                active={c.id === activeId}
                onClick={() => onActive(c.id)}
                menu={
                  <div className="relative">
                    <button
                      className="w-8 h-8 flex items-center justify-center text-muted hover:text-ink"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenu(menu === c.id ? null : c.id);
                      }}
                      aria-label="Actions de la collection"
                    >
                      <DotsIcon />
                    </button>
                    {menu === c.id && (
                      <CollectionMenu
                        galleryId={galleryId}
                        collection={c}
                        collections={items}
                        count={counts[c.id] ?? 0}
                        run={run}
                        onClose={() => setMenu(null)}
                        vertical
                      />
                    )}
                  </div>
                }
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function Row({ collection, count, active, onClick, menu }: { collection: Collection; count: number; active: boolean; onClick: () => void; menu: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: collection.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`flex items-center gap-3 pl-4 pr-3 h-14 cursor-pointer transition-colors ${active ? "bg-bg-soft" : "hover:bg-bg-soft/60"} ${isDragging ? "opacity-70" : ""}`}
      onClick={onClick}
    >
      <span className="text-muted cursor-grab active:cursor-grabbing touch-none" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} aria-label="Déplacer">
        <DragIcon />
      </span>
      <span className={`flex-1 min-w-0 truncate text-[15px] ${active ? "text-ink" : "text-muted"}`}>
        {collection.name} <span className="text-muted">({count})</span>
      </span>
      {menu}
    </li>
  );
}
