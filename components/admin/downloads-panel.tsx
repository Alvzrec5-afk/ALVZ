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
  // Par personne : photos téléchargées (sans doublon) et ZIP, de la plus récente activité à la plus ancienne.
  const byPerson = new Map<string, { photos: Map<string, number>; zips: DownloadRow[]; last: string }>();
  for (const d of downloads) {
    if (!d.email) continue;
    const entry = byPerson.get(d.email) ?? { photos: new Map<string, number>(), zips: [] as DownloadRow[], last: d.created_at };
    if (d.kind === "zip") entry.zips.push(d);
    else if (d.photo_id) entry.photos.set(d.photo_id, (entry.photos.get(d.photo_id) ?? 0) + 1);
    if (d.created_at > entry.last) entry.last = d.created_at;
    byPerson.set(d.email, entry);
  }
  const anonymous = downloads.filter((d) => !d.email).length;

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

      {byPerson.size > 0 && (
        <section>
          <h3 className="label mb-4">Par personne</h3>
          <ul className="space-y-6">
            {[...byPerson.entries()]
              .sort((a, b) => b[1].last.localeCompare(a[1].last))
              .map(([email, entry]) => (
                <li key={email} className="border border-line p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm truncate">{email}</p>
                    <p className="text-xs text-muted shrink-0">
                      {entry.photos.size} photo{entry.photos.size > 1 ? "s" : ""}
                      {entry.zips.length ? ` · ${entry.zips.length} ZIP` : ""} · {dateFmt.format(new Date(entry.last))}
                    </p>
                  </div>
                  {entry.zips.length > 0 && (
                    <p className="text-xs text-muted mt-2">
                      {entry.zips
                        .map((z) => `ZIP ${z.collection_id ? `« ${collectionName.get(z.collection_id) ?? "collection"} »` : "toute la galerie"} (${z.photo_count} photos)`)
                        .join(" · ")}
                    </p>
                  )}
                  {entry.photos.size > 0 && (
                    <ul className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-1.5 mt-3">
                      {[...entry.photos.entries()].map(([id, n]) => {
                        const ph = byId.get(id);
                        return (
                          <li key={id} className="relative aspect-square bg-bg-soft" title={ph?.filename ?? "Photo supprimée"}>
                            {ph && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={ph.thumb} alt={ph.filename} loading="lazy" className="w-full h-full object-cover" />
                            )}
                            {n > 1 && <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[10px] px-1">×{n}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
          </ul>
          {anonymous > 0 && (
            <p className="text-xs text-muted mt-3">
              + {anonymous} téléchargement{anonymous > 1 ? "s" : ""} de visiteurs non identifiés.
            </p>
          )}
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
        <p className="text-xs text-muted mt-3">L&apos;e-mail apparaît quand le visiteur l&apos;a indiqué (favoris, ou option « Demander l&apos;e-mail avant le téléchargement » dans Paramètres → Téléchargement).</p>
      </section>
    </div>
  );
}
