"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GridSize, GridSpacing, GridStyle } from "@/lib/design";
import type { PhotoView } from "@/lib/types";
import { HeartIcon } from "@/components/icons";
import { useT } from "./lang";

type Row = { items: PhotoView[]; height: number };

/** Grille justifiée : chaque ligne remplit la largeur, les proportions sont respectées. */
function computeRows(photos: PhotoView[], width: number, target: number, gap: number): Row[] {
  const rows: Row[] = [];
  let row: PhotoView[] = [];
  let ratios = 0;
  for (const p of photos) {
    row.push(p);
    ratios += p.width / p.height;
    if (ratios * target + gap * (row.length - 1) >= width) {
      rows.push({ items: row, height: (width - gap * (row.length - 1)) / ratios });
      row = [];
      ratios = 0;
    }
  }
  if (row.length) rows.push({ items: row, height: Math.min(target, (width - gap * (row.length - 1)) / ratios) });
  return rows;
}

/** Colonnes : chaque photo va dans la colonne la plus courte (proportions respectées). */
function computeColumns(photos: PhotoView[], count: number) {
  const cols: PhotoView[][] = Array.from({ length: count }, () => []);
  const heights = new Array(count).fill(0);
  for (const p of photos) {
    const i = heights.indexOf(Math.min(...heights));
    cols[i].push(p);
    heights[i] += p.height / p.width;
  }
  return cols;
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Props = {
  photos: PhotoView[];
  style: GridStyle;
  size: GridSize;
  spacing: GridSpacing;
  favorites: Set<string>;
  favoritesEnabled: boolean;
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

export function PhotoGrid({ photos, style, size, spacing, favorites, favoritesEnabled, onOpen, onToggleFavorite }: Props) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const bp = width < 640 ? 0 : width < 1100 ? 1 : 2; // téléphone, tablette, ordinateur
  const gap = spacing === "fine" ? [8, 8, 10][bp] : [16, 20, 28][bp];
  const small = size === "small";
  const target = small ? [110, 180, 220][bp] : [170, 260, 320][bp];
  const columnCount = style === "square" ? (small ? [3, 4, 6] : [2, 3, 4])[bp] : (small ? [3, 4, 5] : [2, 3, 3])[bp];

  const rows = useMemo(() => (width && style === "justified" ? computeRows(photos, width, target, gap) : []), [photos, width, target, gap, style]);
  const cols = useMemo(() => (style === "columns" ? computeColumns(photos, columnCount) : []), [photos, columnCount, style]);

  // Apparition en fondu au défilement
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        // Apparition en cascade : chaque photo d'un même lot arrive un peu après la précédente
        let i = 0;
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.transitionDelay = `${Math.min(i++ * 70, 560)}ms`;
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    el.querySelectorAll(".reveal:not(.is-visible)").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [rows, cols, width, style]);

  const tile = (p: PhotoView, box: React.CSSProperties, displayWidth: number, cover: boolean) => {
    const fav = favorites.has(p.id);
    return (
      <div key={p.id} data-photo-id={p.id} className="reveal group relative bg-bg-soft overflow-hidden" style={box}>
        <button className="block w-full h-full cursor-zoom-in" onClick={() => onOpen(p.id)} aria-label={t("openPhoto", { name: p.filename })}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.thumb}
            srcSet={`${p.thumb} 640w, ${p.web} 2000w`}
            sizes={`${Math.round(displayWidth)}px`}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            ref={(el) => {
              if (el?.complete) el.classList.add("is-loaded");
            }}
            onLoad={(e) => e.currentTarget.classList.add("is-loaded")}
            className={`tile-img w-full h-full ${cover ? "object-cover" : "object-contain"}`}
          />
        </button>
        {favoritesEnabled && (
          <button
            onClick={() => onToggleFavorite(p.id)}
            className={`absolute bottom-1 right-1 w-9 h-9 flex items-center justify-center text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition-opacity ${fav ? "opacity-100" : "opacity-0 group-hover:opacity-90 [@media(hover:none)]:opacity-70"}`}
            aria-label={fav ? t("removeFavorite") : t("addFavorite")}
          >
            <HeartIcon className={`w-5 h-5 ${fav ? "animate-[heartPop_0.45s_ease-out]" : ""}`} filled={fav} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div ref={ref} className="w-full">
      {width > 0 && style === "justified" &&
        rows.map((row, r) => (
          <div key={r} className="flex" style={{ gap, marginBottom: gap }}>
            {row.items.map((p) => {
              const w = (p.width / p.height) * row.height;
              return tile(p, { width: w, height: row.height, flexShrink: 0 }, w, true);
            })}
          </div>
        ))}

      {width > 0 && style === "square" && (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`, gap }}>
          {photos.map((p) => tile(p, { aspectRatio: "1 / 1" }, width / columnCount, true))}
        </div>
      )}

      {width > 0 && style === "columns" && (
        <div className="flex items-start" style={{ gap }}>
          {cols.map((col, i) => (
            <div key={i} className="flex-1 min-w-0 flex flex-col" style={{ gap }}>
              {col.map((p) => tile(p, { aspectRatio: `${p.width} / ${p.height}` }, width / columnCount, true))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
