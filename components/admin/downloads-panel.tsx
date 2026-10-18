"use client";

import { Fragment, useState } from "react";
import type { Collection, PhotoView } from "@/lib/types";
import { DownloadIcon, SortIcon } from "@/components/icons";
import type { AdminVideo } from "./videos-panel";

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

type Line = { key: string; email: string | null; thumb: string | null; name: string; detail: string; at: string };

const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const when = (iso: string) => `${dayFmt.format(new Date(iso))} - ${timeFmt.format(new Date(iso))}`;

const TABS = [
  ["zip", "Galerie"],
  ["photo", "Photo unique"],
  ["video", "Vidéo unique"],
] as const;

/**
 * Activité de téléchargement (façon Pixieset) : ZIP, photos seules, vidéos ; toujours regroupée par personne
 * (une ligne par e-mail, détail au clic) ; tri par date ; export CSV.
 */
export function DownloadsPanel({
  downloads,
  photos,
  collections,
  videos = [],
  galleryTitle = "galerie",
}: {
  downloads: DownloadRow[];
  photos: PhotoView[];
  collections: Collection[];
  videos?: AdminVideo[];
  galleryTitle?: string;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("photo");
  const [newestFirst, setNewestFirst] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const byId = new Map(photos.map((p) => [p.id, p]));
  const collectionName = new Map(collections.map((c) => [c.id, c.name]));

  const lines: Record<(typeof TABS)[number][0], Line[]> = {
    zip: downloads
      .filter((d) => d.kind === "zip")
      .map((d) => ({
        key: d.id,
        email: d.email,
        thumb: null,
        name: d.collection_id ? `Collection « ${collectionName.get(d.collection_id) ?? "supprimée"} »` : "Toute la galerie",
        detail: `${d.photo_count} photo${d.photo_count > 1 ? "s" : ""}`,
        at: d.created_at,
      })),
    photo: downloads
      .filter((d) => d.kind === "photo")
      .map((d) => {
        const p = d.photo_id ? byId.get(d.photo_id) : undefined;
        return {
          key: d.id,
          email: d.email,
          thumb: p?.thumb ?? null,
          name: p?.filename ?? "Photo supprimée",
          detail: d.size === "web" ? "Taille web" : "Haute résolution",
          at: d.created_at,
        };
      }),
    video: videos.flatMap((v) =>
      v.downloadLog.map((d, i) => ({ key: `${v.id}-${i}`, email: d.email, thumb: v.poster, name: v.title, detail: d.quality ?? "", at: d.at })),
    ),
  };
  const sorted = [...lines[tab]].sort((a, b) => b.at.localeCompare(a.at));
  // Une ligne par personne (les visiteurs non identifiés ensemble), la plus récente activité en haut.
  const groups = [...sorted.reduce((m, l) => m.set(l.email ?? "", [...(m.get(l.email ?? "") ?? []), l]), new Map<string, Line[]>()).entries()]
    .map(([email, items]) => ({ email, items, last: items[0].at }))
    .sort((a, b) => (newestFirst ? b.last.localeCompare(a.last) : a.last.localeCompare(b.last)));
  const unit = tab === "video" ? "vidéo" : tab === "zip" ? "ZIP" : "photo";

  function exportCsv() {
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      ["E-mail", tab === "zip" ? "Contenu" : "Fichier", tab === "zip" ? "Photos" : "Résolution", "Date"],
      ...groups.flatMap((g) => g.items.map((l) => [l.email ?? "Non identifié", l.name, l.detail, when(l.at)])),
    ];
    const csv = "﻿" + rows.map((r) => r.map(cell).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `Téléchargements ${galleryTitle} - ${TABS.find((t) => t[0] === tab)![1]}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div>
      <h2 className="text-2xl sm:text-[28px] font-medium">Activité de téléchargement</h2>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mt-8 border-b border-line">
        <div className="flex gap-8">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`pb-3 -mb-px border-b-2 text-[15px] transition-colors ${tab === k ? "border-emerald-500 text-ink" : "border-transparent text-muted hover:text-ink"}`}
            >
              {label}
              {lines[k].length > 0 && <span className="text-muted text-xs ml-1.5">{lines[k].length}</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-5 pb-3 text-sm">
          <button onClick={() => setNewestFirst((n) => !n)} className="flex items-center gap-2 text-muted hover:text-ink">
            <SortIcon className="w-4 h-4" /> {newestFirst ? "Plus récents d'abord" : "Plus anciens d'abord"}
          </button>
          <span className="w-px h-5 bg-line" />
          <button onClick={exportCsv} disabled={!sorted.length} className="flex items-center gap-2 text-accent hover:opacity-80 disabled:opacity-40">
            <DownloadIcon className="w-4 h-4" /> Exporter
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">Aucun téléchargement pour l&apos;instant.</p>
      ) : (
        <>
          <div className="hidden md:grid grid-cols-[1.1fr_1.3fr_0.8fr_1.1fr] gap-4 px-1 pt-6 pb-3 text-[10px] uppercase tracking-[0.12em] text-muted border-b border-line">
            <span>E-mail</span>
            <span>{tab === "zip" ? "Contenu" : tab === "video" ? "Vidéo" : "Nom de fichier"}</span>
            <span>{tab === "zip" ? "Photos" : tab === "video" ? "Qualité" : "Résolution"}</span>
            <span>Date de téléchargement</span>
          </div>
          <ul>
            {groups.map((g) => {
              const isOpen = open === g.email;
              const first = g.items[0];
              const many = g.items.length > 1;
              const details = [...new Set(g.items.map((l) => l.detail))].join(", ");
              return (
                <Fragment key={g.email || "anon"}>
                  <li
                    onClick={() => many && setOpen(isOpen ? null : g.email)}
                    className={`grid grid-cols-[auto_1fr] md:grid-cols-[1.1fr_1.3fr_0.8fr_1.1fr] gap-x-4 gap-y-1 items-center px-1 py-3 text-sm border-t border-line first:border-t-0 ${many ? "cursor-pointer hover:bg-bg-soft" : ""}`}
                  >
                    <span className={`col-span-2 md:col-span-1 truncate ${g.email ? "" : "text-muted italic"}`}>
                      {g.email || "Visiteurs non identifiés"}
                    </span>
                    <span className="col-span-2 md:col-span-1 flex items-center gap-3 min-w-0">
                      <span className="flex shrink-0">
                        {g.items.slice(0, many ? 3 : 1).map((l, i) => (
                          <span
                            key={l.key}
                            className="w-12 h-12 bg-bg-soft flex items-center justify-center text-[10px] text-muted overflow-hidden border-2 border-bg"
                            style={{ marginLeft: i ? -26 : 0, zIndex: 3 - i }}
                          >
                            {l.thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={l.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
                            ) : (
                              "ZIP"
                            )}
                          </span>
                        ))}
                      </span>
                      <span className="truncate">
                        {many ? `${g.items.length} ${unit}${g.items.length > 1 && unit !== "ZIP" ? "s" : ""}` : first.name}
                        {many && <span className="text-muted text-xs ml-2">{isOpen ? "▴" : "▾"}</span>}
                      </span>
                    </span>
                    <span className="text-muted md:text-ink truncate">{details}</span>
                    <span className="text-muted md:text-ink whitespace-nowrap text-right md:text-left">{when(g.last)}</span>
                  </li>
                  {isOpen &&
                    g.items.map((l) => (
                      <li
                        key={l.key}
                        className="grid grid-cols-[auto_1fr] md:grid-cols-[1.1fr_1.3fr_0.8fr_1.1fr] gap-x-4 gap-y-1 items-center px-1 py-2 text-sm bg-bg-soft/60"
                      >
                        <span className="hidden md:block" />
                        <span className="col-span-2 md:col-span-1 flex items-center gap-3 min-w-0">
                          <span className="w-10 h-10 shrink-0 bg-bg-soft flex items-center justify-center text-[10px] text-muted overflow-hidden">
                            {l.thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={l.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
                            ) : (
                              "ZIP"
                            )}
                          </span>
                          <span className="truncate">{l.name}</span>
                        </span>
                        <span className="text-muted">{l.detail}</span>
                        <span className="text-muted whitespace-nowrap text-right md:text-left">{when(l.at)}</span>
                      </li>
                    ))}
                </Fragment>
              );
            })}
          </ul>
        </>
      )}
      <p className="text-xs text-muted mt-6">
        L&apos;e-mail apparaît quand le visiteur l&apos;a indiqué (favoris, ou option « Demander l&apos;e-mail avant le téléchargement » dans
        Paramètres → Téléchargement).
      </p>
    </div>
  );
}
