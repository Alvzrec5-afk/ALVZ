"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PhotoView } from "@/lib/types";
import { ChevronLeft, ChevronRight, CloseIcon, DownloadIcon, HeartIcon } from "@/components/icons";

const EASE = "cubic-bezier(0.22, 0.8, 0.2, 1)";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Position de la vignette d'une photo dans la grille (pour l'effet d'agrandissement). */
function tileRect(id: string) {
  const el = document.querySelector<HTMLElement>(`[data-photo-id="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight ? r : null;
}

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
  onDownload,
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
  /** Avant chaque téléchargement (ex. demander l'e-mail du client). */
  onDownload?: (e: React.MouseEvent, href: string) => void;
}) {
  const photo = photos[index];
  const [loaded, setLoaded] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [dragX, setDragX] = useState(0);
  const [sizeMenu, setSizeMenu] = useState(false);
  const [closing, setClosing] = useState(false);
  const [direction, setDirection] = useState<0 | 1 | -1>(0);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const opened = useRef(false);

  const go = useCallback(
    (to: number, dir: 1 | -1) => {
      if (to < 0 || to >= photos.length) return;
      setDirection(dir);
      onIndex(to);
    },
    [onIndex, photos.length],
  );
  const prev = useCallback(() => go(index - 1, -1), [go, index]);
  const next = useCallback(() => go(index + 1, 1), [go, index]);

  /** Fermeture animée : la photo retourne vers sa vignette. */
  const close = useCallback(() => {
    if (closing) return;
    const frame = frameRef.current;
    const target = photo && tileRect(photo.id);
    if (!frame || prefersReducedMotion()) return onClose();
    setClosing(true);
    const from = frame.getBoundingClientRect();
    frame.style.transition = `transform 0.38s ${EASE}, opacity 0.38s ease`;
    frame.style.transformOrigin = "top left";
    if (target) {
      const s = target.width / from.width;
      frame.style.transform = `translate(${target.left - from.left}px, ${target.top - from.top}px) scale(${s})`;
    } else {
      frame.style.transformOrigin = "center";
      frame.style.transform = "scale(0.92)";
      frame.style.opacity = "0";
    }
    setTimeout(onClose, 360);
  }, [closing, onClose, photo]);

  useEffect(() => setLoaded(false), [photo?.id]);

  // Taille disponible pour la photo (pour calculer son cadre exact)
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ouverture : la photo s'agrandit depuis sa vignette
  useLayoutEffect(() => {
    if (opened.current || !stage.w || !photo) return;
    opened.current = true;
    const frame = frameRef.current;
    const origin = tileRect(photo.id);
    if (!frame || !origin || prefersReducedMotion()) return;
    const to = frame.getBoundingClientRect();
    const s = origin.width / to.width;
    frame.style.transformOrigin = "top left";
    frame.style.transition = "none";
    frame.style.transform = `translate(${origin.left - to.left}px, ${origin.top - to.top}px) scale(${s})`;
    frame.getBoundingClientRect(); // applique la position de départ
    frame.style.transition = `transform 0.5s ${EASE}`;
    frame.style.transform = "none";
  }, [stage.w, photo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [prev, next, close]);

  // Précharge les photos voisines pour une navigation instantanée
  useEffect(() => {
    [photos[index + 1], photos[index - 1]].forEach((p) => {
      if (p) new Image().src = p.web;
    });
  }, [index, photos]);

  if (!photo) return null;
  const fav = favorites.has(photo.id);
  const fit = stage.w ? Math.min(stage.w / photo.width, stage.h / photo.height) : 0;
  const frameW = photo.width * fit;
  const frameH = photo.height * fit;
  const slideClass = direction === 1 ? "animate-[slideFromRight_0.45s_ease-out_both]" : direction === -1 ? "animate-[slideFromLeft_0.45s_ease-out_both]" : "";

  return (
    <div
      className="fixed inset-0 z-50 protect select-none"
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
        else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) close();
        else if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && Date.now() - start.t < 250) setChrome((c) => !c);
      }}
    >
      {/* Fond qui s'assombrit en fondu */}
      <div className={`absolute inset-0 bg-bg transition-opacity duration-300 ${closing ? "opacity-0" : "animate-[fadeIn_0.35s_ease-out_both]"}`} />

      <div
        className={`absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 sm:px-6 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 transition-opacity duration-300 ${chrome && !closing ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <span className="eyebrow text-muted pl-2">{index + 1} / {photos.length}</span>
        <div className="flex items-center gap-1">
          {favoritesEnabled && (
            <button className="icon-btn" onClick={() => onToggleFavorite(photo.id)} aria-label="Favori">
              <HeartIcon className={`w-5 h-5 ${fav ? "text-heart animate-[heartPop_0.45s_ease-out]" : ""}`} filled={fav} />
            </button>
          )}
          {downloadHref && !webDownload && (
            <a className="icon-btn" href={downloadHref(photo.id)} download aria-label="Télécharger en HD" onClick={(e) => onDownload?.(e, downloadHref(photo.id))}>
              <DownloadIcon />
            </a>
          )}
          {downloadHref && webDownload && (
            <div className="relative">
              <button className="icon-btn" onClick={() => setSizeMenu((m) => !m)} aria-label="Télécharger">
                <DownloadIcon />
              </button>
              {sizeMenu && (
                <div className="absolute right-0 mt-1 w-52 bg-bg-soft border border-line py-1 shadow-xl text-sm z-30 animate-[fadeUp_0.2s_ease-out_both]">
                  <a className="block px-4 py-3 hover:bg-bg" href={downloadHref(photo.id, "hd")} download onClick={(e) => {
                    setSizeMenu(false);
                    onDownload?.(e, downloadHref(photo.id, "hd"));
                  }}>
                    Haute définition
                  </a>
                  <a className="block px-4 py-3 hover:bg-bg" href={downloadHref(photo.id, "web")} download onClick={(e) => {
                    setSizeMenu(false);
                    onDownload?.(e, downloadHref(photo.id, "web"));
                  }}>
                    Taille web <span className="text-muted text-xs">(réseaux sociaux)</span>
                  </a>
                </div>
              )}
            </div>
          )}
          <button className="icon-btn" onClick={close} aria-label="Fermer">
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="absolute inset-0 px-0 sm:px-20 py-16 sm:py-20" onClick={(e) => e.target === e.currentTarget && close()}>
        <div ref={stageRef} className="w-full h-full flex items-center justify-center" onClick={(e) => e.target === e.currentTarget && close()}>
          {fit > 0 && (
            <div ref={frameRef} style={{ width: frameW, height: frameH }}>
              <div
                key={photo.id}
                className={`relative w-full h-full ${opened.current && direction !== 0 ? slideClass : ""}`}
                style={{
                  transform: dragX ? `translateX(${dragX}px)` : undefined,
                  transition: dragX ? "none" : `transform 0.3s ${EASE}`,
                  backgroundImage: `url("${photo.thumb}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.web}
                  alt=""
                  draggable={false}
                  ref={(el) => {
                    if (el?.complete) setLoaded(true);
                  }}
                  onLoad={() => setLoaded(true)}
                  className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {index > 0 && (
        <button className={`hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 icon-btn w-12 h-12 transition-opacity ${chrome && !closing ? "" : "opacity-0"}`} onClick={prev} aria-label="Précédente">
          <ChevronLeft />
        </button>
      )}
      {index < photos.length - 1 && (
        <button className={`hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 icon-btn w-12 h-12 transition-opacity ${chrome && !closing ? "" : "opacity-0"}`} onClick={next} aria-label="Suivante">
          <ChevronRight />
        </button>
      )}
    </div>
  );
}
