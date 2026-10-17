"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PhotoView } from "@/lib/types";
import { ChevronLeft, ChevronRight, CloseIcon, DownloadIcon, HeartIcon } from "@/components/icons";

export function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
  favorites,
  favoritesEnabled,
  onToggleFavorite,
  downloadHref,
  webDownload,
}: {
  photos: PhotoView[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  favorites: Set<string>;
  favoritesEnabled: boolean;
  onToggleFavorite: (id: string) => void;
  downloadHref: ((id: string, size?: "hd" | "web") => string) | null;
  webDownload: boolean;
}) {
  const photo = photos[index];
  const [loaded, setLoaded] = useState(false);
  const [chrome, setChrome] = useState(true);
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [sizeMenu, setSizeMenu] = useState(false);
  const prev = useCallback(() => index > 0 && onIndex(index - 1), [index, onIndex]);
  const next = useCallback(() => index < photos.length - 1 && onIndex(index + 1), [index, onIndex, photos.length]);

  useEffect(() => setLoaded(false), [photo?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [prev, next, onClose]);

  // Précharge les photos voisines pour une navigation instantanée
  useEffect(() => {
    [photos[index + 1], photos[index - 1]].forEach((p) => {
      if (p) new Image().src = p.web;
    });
  }, [index, photos]);

  if (!photo) return null;
  const fav = favorites.has(photo.id);

  return (
    <div
      className="fixed inset-0 z-50 bg-bg protect select-none"
      role="dialog"
      aria-modal="true"
      onContextMenu={(e) => e.preventDefault()}
      onTouchStart={(e) => {
        // Un appui sur un bouton (cœur, téléchargement, fermer) n'est pas un geste sur la photo.
        if ((e.target as HTMLElement).closest("button, a")) {
          touch.current = null;
          return;
        }
        const t = e.touches[0];
        touch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
      }}
      onTouchMove={(e) => {
        if (!touch.current || e.touches.length > 1) return;
        const dx = e.touches[0].clientX - touch.current.x;
        const dy = e.touches[0].clientY - touch.current.y;
        if (Math.abs(dx) > Math.abs(dy)) setDragX(dx);
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        setDragX(0);
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
        else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
        else if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && Date.now() - start.t < 250) setChrome((c) => !c);
      }}
    >
      <div
        className={`absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 sm:px-6 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 transition-opacity duration-300 ${chrome ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <span className="eyebrow text-muted pl-2">{index + 1} / {photos.length}</span>
        <div className="flex items-center gap-1">
          {favoritesEnabled && (
            <button className="icon-btn" onClick={() => onToggleFavorite(photo.id)} aria-label="Favori">
              <HeartIcon className={`w-5 h-5 ${fav ? "text-heart" : ""}`} filled={fav} />
            </button>
          )}
          {downloadHref && !webDownload && (
            <a className="icon-btn" href={downloadHref(photo.id)} download aria-label="Télécharger en HD">
              <DownloadIcon />
            </a>
          )}
          {downloadHref && webDownload && (
            <div className="relative">
              <button className="icon-btn" onClick={() => setSizeMenu((m) => !m)} aria-label="Télécharger">
                <DownloadIcon />
              </button>
              {sizeMenu && (
                <div className="absolute right-0 mt-1 w-52 bg-bg-soft border border-line py-1 shadow-xl text-sm z-30">
                  <a className="block px-4 py-3 hover:bg-bg" href={downloadHref(photo.id, "hd")} download onClick={() => setSizeMenu(false)}>
                    Haute définition
                  </a>
                  <a className="block px-4 py-3 hover:bg-bg" href={downloadHref(photo.id, "web")} download onClick={() => setSizeMenu(false)}>
                    Taille web <span className="text-muted text-xs">(réseaux sociaux)</span>
                  </a>
                </div>
              )}
            </div>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-0 sm:px-20 py-16 sm:py-20" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.web}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(true)}
          className={`max-w-full max-h-full object-contain transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
          style={{ transform: dragX ? `translateX(${dragX}px)` : undefined, transition: dragX ? "none" : undefined, aspectRatio: `${photo.width} / ${photo.height}` }}
        />
      </div>

      {index > 0 && (
        <button className={`hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 icon-btn w-12 h-12 transition-opacity ${chrome ? "" : "opacity-0"}`} onClick={prev} aria-label="Précédente">
          <ChevronLeft />
        </button>
      )}
      {index < photos.length - 1 && (
        <button className={`hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 icon-btn w-12 h-12 transition-opacity ${chrome ? "" : "opacity-0"}`} onClick={next} aria-label="Suivante">
          <ChevronRight />
        </button>
      )}
    </div>
  );
}
