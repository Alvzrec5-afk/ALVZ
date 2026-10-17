"use client";

import { useState } from "react";
import type { Collection, PhotoView } from "@/lib/types";

export function FavoritesPanel({
  lists,
  photos,
  collections,
}: {
  lists: { id: string; email: string; photoIds: string[] }[];
  photos: PhotoView[];
  collections: Collection[];
}) {
  const byId = new Map(photos.map((p) => [p.id, p]));
  const collectionName = new Map(collections.map((c) => [c.id, c.name]));
  const [copied, setCopied] = useState<string | null>(null);

  if (lists.length === 0) {
    return <p className="py-16 text-center text-sm text-muted">Aucun client n&apos;a encore sélectionné de favoris.</p>;
  }

  return (
    <div className="space-y-16">
      {lists.map((l) => {
        const selected = l.photoIds.map((id) => byId.get(id)).filter((p): p is PhotoView => Boolean(p));
        const names = selected.map((p) => p.filename.replace(/\.[^.]+$/, "")).join(", ");
        return (
          <section key={l.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
              <h2 className="text-base">
                {l.email} <span className="text-muted text-sm ml-2">{selected.length} favori{selected.length > 1 ? "s" : ""}</span>
              </h2>
              {selected.length > 0 && (
                <button
                  className="eyebrow text-muted hover:text-ink"
                  onClick={async () => {
                    await navigator.clipboard.writeText(names);
                    setCopied(l.id);
                    setTimeout(() => setCopied(null), 2000);
                  }}
                  title="Liste des noms de fichiers, à coller dans Lightroom pour filtrer"
                >
                  {copied === l.id ? "Copié ✓" : "Copier les noms de fichiers"}
                </button>
              )}
            </div>
            {selected.length === 0 ? (
              <p className="text-sm text-muted">Aucun favori pour l&apos;instant.</p>
            ) : (
              <ul className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
                {selected.map((p) => (
                  <li key={p.id} className="relative aspect-square bg-bg-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumb} alt={p.filename} loading="lazy" className="w-full h-full object-cover" title={`${collectionName.get(p.collectionId)} / ${p.filename}`} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
