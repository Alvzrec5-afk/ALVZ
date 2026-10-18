"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { addCollection, renameCollection, reorderCollections } from "@/app/admin/actions";
import type { Collection } from "@/lib/types";
import { purge } from "./purge";
import { deleteInBackground } from "./background";

export async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
  return json;
}

/** Lance une action, affiche l'erreur éventuelle, puis rafraîchit la page. */
export function useRun() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
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
  return { busy, run };
}

export function promptNewCollection(galleryId: string, run: (fn: () => Promise<unknown>) => void) {
  const name = prompt("Nom de la nouvelle collection (ex : Cérémonie)");
  if (name)
    run(async () => {
      const r = await addCollection(galleryId, name);
      if (r.error) throw new Error(r.error);
    });
}

/** Actions d'une collection (menu ⋯), partagées par la version mobile et la colonne ordinateur. */
export function CollectionMenu({
  galleryId,
  collection,
  collections,
  count,
  run,
  onClose,
  vertical,
  className = "",
}: {
  galleryId: string;
  collection: Collection;
  collections: Collection[];
  count: number;
  run: (fn: () => Promise<unknown>) => void;
  onClose: () => void;
  vertical?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const move = (dir: -1 | 1) =>
    run(async () => {
      const ids = collections.map((c) => c.id);
      const i = ids.indexOf(collection.id);
      if (i + dir < 0 || i + dir >= ids.length) return;
      await reorderCollections(galleryId, arrayMove(ids, i, i + dir));
    });
  const item = "block w-full text-left px-4 py-3 hover:bg-bg";
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className={`absolute right-0 mt-1 z-20 w-64 bg-bg-soft border border-line py-1 shadow-xl text-sm ${className}`} onClick={onClose}>
        {!vertical && (
          <button className={item} onClick={() => promptNewCollection(galleryId, run)}>Nouvelle collection</button>
        )}
        <button className={item} onClick={() => run(() => post("/api/admin/photos/sort-by-date", { collectionId: collection.id }))}>
          Trier par date de prise de vue
        </button>
        <button
          className={item}
          onClick={() => {
            const name = prompt("Nouveau nom", collection.name);
            if (name && name !== collection.name)
              run(async () => {
                const r = await renameCollection(galleryId, collection.id, name);
                if (r.error) throw new Error(r.error);
              });
          }}
        >
          Renommer la collection
        </button>
        {collections.length > 1 && (
          <>
            <button className={item} onClick={() => move(-1)}>{vertical ? "Monter" : "Déplacer vers la gauche"}</button>
            <button className={item} onClick={() => move(1)}>{vertical ? "Descendre" : "Déplacer vers la droite"}</button>
          </>
        )}
        <button
          className={`${item} text-danger`}
          onClick={() => {
            if (confirm(`Supprimer la collection « ${collection.name} » et ses ${count} photos ?`)) {
              onClose();
              deleteInBackground([collection.id], () => purge("collection", collection.id), () => router.refresh());
            }
          }}
        >
          Supprimer la collection
        </button>
        <p className="px-4 pt-2 pb-2 text-[11px] text-muted border-t border-line mt-1">
          {vertical ? "Astuce : glissez une collection par ≡ pour la déplacer." : "Astuce : maintenez une photo puis glissez-la pour la déplacer."}
        </p>
      </div>
    </>
  );
}
