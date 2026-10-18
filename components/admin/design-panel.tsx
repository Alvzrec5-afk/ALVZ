"use client";

import { useEffect, useState } from "react";
import {
  COLOR_THEMES,
  COVER_LAYOUTS,
  FONT_STYLES,
  GRID_SIZES,
  GRID_SPACINGS,
  GRID_STYLES,
  NAV_STYLES,
  themeAttr,
  type ColorTheme,
  type CoverLayout,
  type FontStyle,
  type GalleryDesign,
  type GridSize,
  type GridSpacing,
  type GridStyle,
  type NavStyle,
} from "@/lib/design";
import type { PhotoView } from "@/lib/types";
import { GridIcon, ImageIcon, PaletteIcon, TypeIcon } from "@/components/icons";
import type { ManagedGallery } from "./gallery-manager";
import { CoverPreview } from "./cover-preview";
import { ListRow, OptionCard, SubHeader } from "./ui";
import { SaveStatus, useSave } from "./use-save";

type View = "menu" | "cover" | "type" | "color" | "grid";

export function DesignPanel({ gallery, photos }: { gallery: ManagedGallery; photos: PhotoView[] }) {
  const [view, setView] = useState<View>("menu");
  const [design, setDesign] = useState<GalleryDesign>(gallery.design);
  const [coverId, setCoverId] = useState(gallery.coverPhotoId);
  const [coverTab, setCoverTab] = useState<"layout" | "photo" | "focus">("layout");
  const { save, status } = useSave(gallery.id);

  useEffect(() => setDesign(gallery.design), [gallery.design]);
  useEffect(() => setCoverId(gallery.coverPhotoId), [gallery.coverPhotoId]);

  const update = (patch: Partial<GalleryDesign>) => {
    setDesign((d) => ({ ...d, ...patch }));
    save(patch);
  };
  const cover = photos.find((p) => p.id === coverId) ?? photos[0] ?? null;
  const second = photos.find((p) => p.id !== cover?.id) ?? null;
  const theme = themeAttr(design);

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
        <ListRow icon={<TypeIcon />} label="Typographie" value={FONT_STYLES[design.font_style].label} onClick={() => setView("type")} />
        <ListRow icon={<PaletteIcon />} label="Couleur" value={design.color_follow_device ? "Automatique" : COLOR_THEMES[design.color_theme].label} onClick={() => setView("color")} />
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
        <div className="flex border border-line mb-8">
          {([
            ["layout", "Mise en page"],
            ["photo", "Photo"],
            ["focus", "Point de cadrage"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setCoverTab(k)}
              className={`flex-1 py-3 text-[11px] tracking-wider uppercase transition-colors ${coverTab === k ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {coverTab === "layout" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-theme={theme}>
            {(Object.keys(COVER_LAYOUTS) as CoverLayout[]).map((k) => (
              <OptionCard key={k} selected={design.cover_layout === k} onClick={() => update({ cover_layout: k })} label={COVER_LAYOUTS[k]}>
                <div className={`fs-${design.font_style}`}>
                  <CoverPreview layout={k} src={cover?.thumb ?? null} src2={second?.thumb ?? null} title={gallery.title} />
                </div>
              </OptionCard>
            ))}
          </div>
        )}

        {coverTab === "photo" &&
          (photos.length === 0 ? (
            <p className="text-sm text-muted">Envoyez d&apos;abord des photos dans la section Photos.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {photos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setCoverId(p.id);
                    save({ cover_photo_id: p.id });
                  }}
                  className={`relative aspect-square border-2 ${p.id === cover?.id ? "border-accent" : "border-transparent"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
                  {p.id === cover?.id && <span className="absolute top-1 left-1 bg-black/60 text-white text-[9px] tracking-widest uppercase px-1.5 py-0.5">Couverture</span>}
                </button>
              ))}
            </div>
          ))}

        {coverTab === "focus" &&
          (cover ? (
            <>
              <p className="text-xs text-muted mb-4">Touchez la zone à garder visible quand la photo est recadrée (un visage, par exemple).</p>
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div
                  className="relative cursor-crosshair select-none w-full sm:w-auto sm:max-w-md"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    update({
                      cover_focus_x: Math.round(((e.clientX - r.left) / r.width) * 100),
                      cover_focus_y: Math.round(((e.clientY - r.top) / r.height) * 100),
                    });
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cover.web} alt="" className="w-full h-auto block" draggable={false} />
                  <span
                    className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] pointer-events-none transition-[left,top] duration-300"
                    style={{ left: `${design.cover_focus_x}%`, top: `${design.cover_focus_y}%` }}
                  />
                </div>
                <div className="flex gap-3">
                  {[
                    ["w-24 h-44", "Téléphone"],
                    ["w-44 h-28", "Ordinateur"],
                  ].map(([size, label]) => (
                    <div key={label}>
                      <div className={`${size} overflow-hidden bg-bg-soft`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cover.web} alt="" className="w-full h-full object-cover" style={{ objectPosition: `${design.cover_focus_x}% ${design.cover_focus_y}%` }} />
                      </div>
                      <p className="text-[10px] text-muted mt-1 text-center">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Envoyez d&apos;abord des photos dans la section Photos.</p>
          ))}
        {footer}
      </div>
    );
  }

  if (view === "type") {
    return (
      <div>
        <SubHeader title="Typographie" onBack={back} />
        <div className="grid grid-cols-2 gap-4">
          {(Object.keys(FONT_STYLES) as FontStyle[]).map((k) => (
            <OptionCard key={k} selected={design.font_style === k} onClick={() => update({ font_style: k })} label={FONT_STYLES[k].label}>
              <div data-theme={theme} className={`fs-${k} bg-bg text-ink px-4 py-7 min-h-[118px]`}>
                <p className="gallery-title text-[17px] sm:text-xl whitespace-nowrap overflow-hidden">{FONT_STYLES[k].label}</p>
                <p className="mt-2 text-xs text-muted leading-snug" style={{ fontFamily: "var(--g-font)", fontStyle: "var(--g-style, normal)" }}>
                  {FONT_STYLES[k].hint}
                </p>
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
          <OptionCard selected={design.color_follow_device} onClick={() => update({ color_follow_device: true })} label="Automatique">
            <div className="flex h-24">
              <div className="flex-1 flex items-center justify-center gap-1.5 bg-white">
                <Dot c="#ffffff" />
                <Dot c="#2b2b2b" />
              </div>
              <div className="flex-1 flex items-center justify-center gap-1.5 bg-[#0e0e0d]">
                <Dot c="#0e0e0d" />
                <Dot c="#ece8e2" />
              </div>
            </div>
          </OptionCard>
          {(Object.keys(COLOR_THEMES) as ColorTheme[]).map((k) => (
            <OptionCard
              key={k}
              selected={!design.color_follow_device && design.color_theme === k}
              onClick={() => update({ color_theme: k, color_follow_device: false })}
              label={COLOR_THEMES[k].label}
            >
              <div className="h-24 flex items-center justify-center gap-1.5 bg-bg">
                {COLOR_THEMES[k].swatch.map((c, i) => (
                  <Dot key={i} c={c} />
                ))}
              </div>
            </OptionCard>
          ))}
        </div>
        <p className="text-xs text-muted mt-6">« Automatique » suit le mode clair / sombre du téléphone du client.</p>
        {footer}
      </div>
    );
  }

  return (
    <div>
      <SubHeader title="Grille" onBack={back} />
      <p className="label mb-4">Style de grille</p>
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(GRID_STYLES) as GridStyle[]).map((k) => (
          <OptionCard key={k} selected={design.grid_style === k} onClick={() => update({ grid_style: k })} label={GRID_STYLES[k]}>
            <Glyph kind={`style-${k}`} />
          </OptionCard>
        ))}
      </div>
      <p className="label mt-10 mb-4">Taille des miniatures</p>
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(GRID_SIZES) as GridSize[]).map((k) => (
          <OptionCard key={k} selected={design.grid_size === k} onClick={() => update({ grid_size: k })} label={GRID_SIZES[k]}>
            <Glyph kind={`size-${k}`} />
          </OptionCard>
        ))}
      </div>
      <p className="label mt-10 mb-4">Espacement de la grille</p>
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(GRID_SPACINGS) as GridSpacing[]).map((k) => (
          <OptionCard key={k} selected={design.grid_spacing === k} onClick={() => update({ grid_spacing: k })} label={GRID_SPACINGS[k]}>
            <Glyph kind={`spacing-${k}`} />
          </OptionCard>
        ))}
      </div>
      <p className="label mt-10 mb-4">Style de navigation</p>
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(NAV_STYLES) as NavStyle[]).map((k) => (
          <OptionCard key={k} selected={design.nav_style === k} onClick={() => update({ nav_style: k })} label={NAV_STYLES[k]}>
            <Glyph kind={`nav-${k}`} />
          </OptionCard>
        ))}
      </div>
      {footer}
    </div>
  );
}

function Dot({ c }: { c: string }) {
  return <span className="w-8 h-8 rounded-full border border-black/10" style={{ background: c }} />;
}

/** Pictogrammes des options de grille. */
function Glyph({ kind }: { kind: string }) {
  const cell = "bg-ink";
  const wrap = "h-24 flex items-center justify-center";
  const grid = (cols: number, rows: number, gap: number, size = 36) => (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, width: size, height: size }}>
      {Array.from({ length: cols * rows }, (_, i) => <span key={i} className={cell} />)}
    </div>
  );
  switch (kind) {
    case "style-columns":
      return (
        <div className={wrap}>
          <div className="flex gap-[3px] w-9 h-9">
            <div className="flex-1 flex flex-col gap-[3px]"><span className={`${cell} h-[60%]`} /><span className={`${cell} flex-1`} /></div>
            <div className="flex-1 flex flex-col gap-[3px]"><span className={`${cell} h-[35%]`} /><span className={`${cell} flex-1`} /></div>
          </div>
        </div>
      );
    case "style-justified":
      return (
        <div className={wrap}>
          <div className="flex flex-col gap-[3px] w-9 h-9">
            <div className="flex-1 flex gap-[3px]"><span className={`${cell} w-[60%]`} /><span className={`${cell} flex-1`} /></div>
            <div className="flex-1 flex gap-[3px]"><span className={`${cell} w-[35%]`} /><span className={`${cell} flex-1`} /></div>
          </div>
        </div>
      );
    case "style-square":
    case "size-small":
      return <div className={wrap}>{grid(3, 3, 3)}</div>;
    case "size-large":
      return (
        <div className={wrap}>
          <div className="flex gap-[3px] w-9 h-9">
            <span className={`${cell} w-1/2`} />
            <div className="flex-1 flex flex-col gap-[3px]"><span className={`${cell} flex-1`} /><span className={`${cell} flex-1`} /></div>
          </div>
        </div>
      );
    case "spacing-fine":
      return <div className={wrap}>{grid(2, 2, 3, 34)}</div>;
    case "spacing-wide":
      return <div className={wrap}>{grid(2, 2, 10, 34)}</div>;
    case "nav-icons":
      return (
        <div className={wrap}>
          <span className="w-9 h-9 border-[1.5px] border-ink rounded-md" />
        </div>
      );
    default:
      return (
        <div className={wrap}>
          <span className="w-9 h-9 border-[1.5px] border-ink rounded-md flex items-center justify-center text-lg">A</span>
        </div>
      );
  }
}
