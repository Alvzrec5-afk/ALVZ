"use client";

import type { Collection, PhotoView } from "@/lib/types";

export type DownloadRow = {
  id: string;
  photo_id: string | null;
  collection_id: string | null;
  kind: "photo" | "zip";
  size: "hd" | "web";
  photo_count: number;
  email: string | null;
  created_at: string;
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/** Activité de téléchargement : photos les plus téléchargées et historique. */
export function DownloadsPanel({ downloads, photos, collections }: { downloads: DownloadRow[]; photos: PhotoView[]; collections: Collection[] }) {
  if (downloads.length === 0) {
    return <p className="py-16 text-center text-sm text-muted">Aucun téléchargement pour l&apos;instant.</p>;
  }
  const byId = new Map(photos.map((p) => [p.id, p]));
  const collectionName = new Map(collections.map((c) => [c.id, c.name]));
  const singles = downloads.filter((d) => d.kind === "photo");
  const zips = downloads.filter((d) => d.kind === "zip");
  const counts = new Map<string, number>();
  singles.forEach((d) => d.photo_id && counts.set(d.photo_id, (counts.get(d.photo_id) ?? 0) + 1));
  const ranking = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const people = new Set(downloads.map((d) => d.email).filter(Boolean));

  return (
    <div className="space-y-14">
      <div className="grid grid-cols-3 gap-3">
        {[
          [singles.length, "photo" + (singles.length > 1 ? "s" : "") + " téléchargée" + (singles.length > 1 ? "s" : "")],
          [zips.length, "ZIP"],
          [people.size, "personne" + (people.size > 1 ? "s" : "") + " identifiée" + (people.size > 1 ? "s" : "")],
        ].map(([n, label]) => (
          <div key={label as string} className="border border-line px-4 py-5 text-center">
            <p className="display text-3xl">{n}</p>
            <p className="text-[11px] text-muted mt-1">{label}</p>
          </div>
        ))}
      </div>

      {ranking.length > 0 && (
        <section>
          <h3 className="label mb-4">Photos les plus téléchargées</h3>
          <ul className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
            {ranking.map(([id, n]) => {
              const p = byId.get(id);
              return (
                <li key={id} className="relative aspect-square bg-bg-soft" title={p?.filename}>
                  {p && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumb} alt={p.filename} loading="lazy" className="w-full h-full object-cover" />
                  )}
                  <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[11px] px-1.5 py-0.5">↓ {n}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h3 className="label mb-4">Historique</h3>
        <ul className="divide-y divide-line border-y border-line">
          {downloads.slice(0, 200).map((d) => {
            const p = d.photo_id ? byId.get(d.photo_id) : undefined;
            const what =
              d.kind === "zip"
                ? `ZIP · ${d.collection_id ? `« ${collectionName.get(d.collection_id) ?? "collection"} »` : "toute la galerie"} · ${d.photo_count} photos`
                : `${p?.filename ?? "Photo supprimée"} · ${d.size === "web" ? "taille web" : "HD"}`;
            return (
              <li key={d.id} className="flex items-center gap-3 py-3 text-sm">
                <div className="w-10 h-10 shrink-0 bg-bg-soft flex items-center justify-center text-muted text-xs">
                  {p ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    "ZIP"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate">{what}</p>
                  <p className="text-xs text-muted truncate">{d.email ?? "Visiteur non identifié"}</p>
                </div>
                <span className="text-xs text-muted shrink-0">{dateFmt.format(new Date(d.created_at))}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted mt-3">L&apos;e-mail apparaît quand le visiteur l&apos;a indiqué pour ses favoris.</p>
      </section>
    </div>
  );
}
