"use client";

import { useEffect, useState } from "react";
import {
  COLOR_THEMES,
  COVER_LAYOUTS,
  FONT_STYLES,
  GRID_SIZES,
  GRID_SPACINGS,
  GRID_STYLES,
  type ColorTheme,
  type CoverLayout,
  type FontStyle,
  type GalleryDesign,
  type GridStyle,
} from "@/lib/design";
import type { PhotoView } from "@/lib/types";
import { GridIcon, ImageIcon, PaletteIcon, TypeIcon } from "@/components/icons";
import type { ManagedGallery } from "./gallery-manager";
import { ListRow, OptionCard, Segmented, SubHeader } from "./ui";
import { SaveStatus, useSave } from "./use-save";

type View = "menu" | "cover" | "type" | "color" | "grid";

export function DesignPanel({ gallery, photos }: { gallery: ManagedGallery; photos: PhotoView[] }) {
  const [view, setView] = useState<View>("menu");
  const [design, setDesign] = useState<GalleryDesign>(gallery.design);
  const [coverId, setCoverId] = useState(gallery.coverPhotoId);
  const { save, status } = useSave(gallery.id);

  useEffect(() => setDesign(gallery.design), [gallery.design]);
  useEffect(() => setCoverId(gallery.coverPhotoId), [gallery.coverPhotoId]);

  const update = (patch: Partial<GalleryDesign>) => {
    setDesign((d) => ({ ...d, ...patch }));
    save(patch);
  };
  const cover = photos.find((p) => p.id === coverId) ?? photos[0] ?? null;

  const preview = (
    <a href={`/g/${gallery.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost">Aperçu ↗</a>
  );

  if (view === "menu") {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="eyebrow text-muted">Design</p>
          {preview}
        </div>
        <ListRow icon={<ImageIcon />} label="Couverture" value={COVER_LAYOUTS[design.cover_layout]} onClick={() => setView("cover")} />
        <ListRow icon={<TypeIcon />} label="Typographie" value={FONT_STYLES[design.font_style]} onClick={() => setView("type")} />
        <ListRow icon={<PaletteIcon />} label="Couleur" value={COLOR_THEMES[design.color_theme].label} onClick={() => setView("color")} />
        <ListRow icon={<GridIcon />} label="Grille" value={GRID_STYLES[design.grid_style]} onClick={() => setView("grid")} />
      </div>
    );
  }

  const back = () => setView("menu");
  const footer = (
    <div className="mt-10 flex items-center justify-between gap-4">
      <SaveStatus status={status} />
      {preview}
    </div>
  );

  if (view === "cover") {
    return (
      <div>
        <SubHeader title="Couverture" onBack={back} />
        <p className="label mb-4">Mise en page</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(Object.keys(COVER_LAYOUTS) as CoverLayout[]).map((k) => (
            <OptionCard key={k} selected={design.cover_layout === k} onClick={() => update({ cover_layout: k })} label={COVER_LAYOUTS[k]}>
              <CoverSketch layout={k} />
            </OptionCard>
          ))}
        </div>

        <p className="label mt-12 mb-4">Photo de couverture</p>
        {photos.length === 0 ? (
          <p className="text-sm text-muted">Envoyez d&apos;abord des photos dans l&apos;onglet Photos.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {photos.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setCoverId(p.id);
                  save({ cover_photo_id: p.id });
                }}
                className={`shrink-0 w-20 h-20 border-2 ${p.id === cover?.id ? "border-emerald-500" : "border-transparent"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {cover && (
          <>
            <p className="label mt-12 mb-2">Point de cadrage</p>
            <p className="text-xs text-muted mb-4">Touchez la zone à garder visible quand la photo est recadrée (un visage, par exemple).</p>
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div
                className="relative cursor-crosshair select-none w-full sm:w-auto sm:max-w-md"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const x = Math.round(((e.clientX - r.left) / r.width) * 100);
                  const y = Math.round(((e.clientY - r.top) / r.height) * 100);
                  update({ cover_focus_x: x, cover_focus_y: y });
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cover.web} alt="" className="w-full h-auto block" draggable={false} />
                <span
                  className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] pointer-events-none"
                  style={{ left: `${design.cover_focus_x}%`, top: `${design.cover_focus_y}%` }}
                />
              </div>
              <div className="flex gap-3">
                <div>
                  <div className="w-24 h-44 overflow-hidden bg-bg-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cover.web} alt="" className="w-full h-full object-cover" style={{ objectPosition: `${design.cover_focus_x}% ${design.cover_focus_y}%` }} />
                  </div>
                  <p className="text-[10px] text-muted mt-1 text-center">Téléphone</p>
                </div>
                <div>
                  <div className="w-44 h-28 overflow-hidden bg-bg-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cover.web} alt="" className="w-full h-full object-cover" style={{ objectPosition: `${design.cover_focus_x}% ${design.cover_focus_y}%` }} />
                  </div>
                  <p className="text-[10px] text-muted mt-1 text-center">Ordinateur</p>
                </div>
              </div>
            </div>
          </>
        )}
        {footer}
      </div>
    );
  }

  if (view === "type") {
    return (
      <div>
        <SubHeader title="Typographie" onBack={back} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(Object.keys(FONT_STYLES) as FontStyle[]).map((k) => (
            <OptionCard key={k} selected={design.font_style === k} onClick={() => update({ font_style: k })} label={FONT_STYLES[k]}>
              <div data-theme={design.color_theme} className={`fs-${k} bg-bg text-ink px-5 py-8 text-center`}>
                <p className="gallery-title text-2xl truncate">{gallery.title}</p>
                <p className="eyebrow text-muted mt-3 text-[9px]">14 juin 2026</p>
              </div>
            </OptionCard>
          ))}
        </div>
        {footer}
      </div>
    );
  }

  if (view === "color") {
    return (
      <div>
        <SubHeader title="Couleur" onBack={back} />
        <div className="grid grid-cols-2 gap-4">
          {(Object.keys(COLOR_THEMES) as ColorTheme[]).map((k) => (
            <OptionCard key={k} selected={design.color_theme === k} onClick={() => update({ color_theme: k })} label={COLOR_THEMES[k].label}>
              <div data-theme={k} className={`fs-${design.font_style} bg-bg text-ink px-4 py-6`}>
                <p className="gallery-title text-lg truncate">{gallery.title}</p>
                <div className="mt-4 grid grid-cols-3 gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="aspect-square bg-bg-soft" />
                  ))}
                </div>
              </div>
            </OptionCard>
          ))}
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div>
      <SubHeader title="Grille" onBack={back} />
      <p className="label mb-4">Style</p>
      <div className="grid grid-cols-3 gap-4">
        {(Object.keys(GRID_STYLES) as GridStyle[]).map((k) => (
          <OptionCard key={k} selected={design.grid_style === k} onClick={() => update({ grid_style: k })} label={GRID_STYLES[k]}>
            <GridSketch style={k} />
          </OptionCard>
        ))}
      </div>
      <p className="label mt-10 mb-4">Taille des vignettes</p>
      <Segmented value={design.grid_size} options={GRID_SIZES} onChange={(v) => update({ grid_size: v })} />
      <p className="label mt-10 mb-4">Espacement</p>
      <Segmented value={design.grid_spacing} options={GRID_SPACINGS} onChange={(v) => update({ grid_spacing: v })} />
      {footer}
    </div>
  );
}

/** Petits schémas des mises en page de couverture. */
function CoverSketch({ layout }: { layout: CoverLayout }) {
  const line = <span className="block h-1.5 w-12 bg-white/80" />;
  const small = <span className="block h-1 w-6 bg-white/50 mt-1" />;
  if (layout === "split") {
    return (
      <div className="aspect-[4/3] flex bg-bg">
        <div className="w-1/2 flex flex-col items-center justify-center">
          <span className="block h-1.5 w-10 bg-ink/70" />
          <span className="block h-1 w-5 bg-ink/40 mt-1" />
        </div>
        <div className="w-1/2 bg-muted/60" />
      </div>
    );
  }
  if (layout === "framed") {
    return (
      <div className="aspect-[4/3] bg-bg p-3 flex flex-col items-center">
        <div className="w-full flex-1 bg-muted/60" />
        <span className="block h-1.5 w-10 bg-ink/70 mt-2" />
      </div>
    );
  }
  return (
    <div className={`aspect-[4/3] bg-muted/60 flex flex-col p-3 ${layout === "center" ? "items-center justify-center" : "items-start justify-end"}`}>
      {line}
      {small}
    </div>
  );
}

function GridSketch({ style }: { style: GridStyle }) {
  const c = "bg-muted/60";
  if (style === "square") {
    return (
      <div className="aspect-square p-2 grid grid-cols-3 gap-1 bg-bg">
        {Array.from({ length: 9 }, (_, i) => <div key={i} className={c} />)}
      </div>
    );
  }
  if (style === "columns") {
    return (
      <div className="aspect-square p-2 flex gap-1 bg-bg">
        {[[40, 25, 30], [25, 45, 25], [30, 30, 35]].map((col, i) => (
          <div key={i} className="flex-1 flex flex-col gap-1">
            {col.map((h, j) => <div key={j} className={c} style={{ height: `${h}%` }} />)}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="aspect-square p-2 flex flex-col gap-1 bg-bg">
      {[[2, 1, 1.5], [1, 2], [1.5, 1, 1]].map((row, i) => (
        <div key={i} className="flex-1 flex gap-1">
          {row.map((w, j) => <div key={j} className={c} style={{ flex: w }} />)}
        </div>
      ))}
    </div>
  );
}
