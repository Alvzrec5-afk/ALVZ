"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PhotoView } from "@/lib/types";
import { HeartIcon } from "@/components/icons";

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

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function JustifiedGrid({
  photos,
  favorites,
  onOpen,
  onToggleFavorite,
}: {
  photos: PhotoView[];
  favorites: Set<string>;
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
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

  const mobile = width > 0 && width < 640;
  const gap = mobile ? 4 : 8;
  const target = mobile ? 170 : width < 1100 ? 260 : 320;
  const rows = useMemo(() => (width ? computeRows(photos, width, target, gap) : []), [photos, width, target, gap]);

  // Apparition en fondu au défilement
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -6% 0px" },
    );
    el.querySelectorAll(".reveal:not(.is-visible)").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [rows]);

  return (
    <div ref={ref} className="w-full">
      {rows.map((row, r) => (
        <div key={r} className="flex" style={{ gap, marginBottom: gap }}>
          {row.items.map((p) => {
            const w = (p.width / p.height) * row.height;
            const fav = favorites.has(p.id);
            return (
              <div key={p.id} className="reveal group relative bg-bg-soft shrink-0 overflow-hidden" style={{ width: w, height: row.height }}>
                <button className="block w-full h-full cursor-zoom-in" onClick={() => onOpen(p.id)} aria-label={`Ouvrir ${p.filename}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.thumb}
                    srcSet={`${p.thumb} 640w, ${p.web} 2000w`}
                    sizes={`${Math.round(w)}px`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="w-full h-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.015]"
                  />
                </button>
                <button
                  onClick={() => onToggleFavorite(p.id)}
                  className={`absolute bottom-1.5 right-1.5 w-9 h-9 flex items-center justify-center text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition-opacity ${fav ? "opacity-100" : "opacity-0 group-hover:opacity-90 [@media(hover:none)]:opacity-70"}`}
                  aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
                >
                  <HeartIcon className="w-5 h-5" filled={fav} />
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
