"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PhotoView } from "@/lib/types";
import { ChevronLeft, ChevronRight, CloseIcon, DownloadIcon, HeartIcon } from "@/components/icons";

const EASE = "cubic-bezier(0.22, 0.8, 0.2, 1)";
const MAX_ZOOM = 4;
const TAP_ZOOM = 2.5;

type Zoom = { s: number; x: number; y: number };
const NO_ZOOM: Zoom = { s: 1, x: 0, y: 0 };
const dist = (a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

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
  // Zoom dans la photo (pincement, double-tap, molette) : la page de la galerie, elle, ne zoome pas.
  const [zoom, setZoom] = useState<Zoom>(NO_ZOOM);
  const [zooming, setZooming] = useState(false); // pendant un geste : pas d'animation
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const pinch = useRef<{ d: number; s: number; x: number; y: number; cx: number; cy: number } | null>(null);
  const pan = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const touchZoomAt = useRef(0); // heure du dernier double-tap (le navigateur en fait aussi un double-clic : à ignorer)
  const zoomed = zoom.s > 1.01;

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
    setZoom(NO_ZOOM);
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

  useEffect(() => {
    setLoaded(false);
    setZoom(NO_ZOOM);
  }, [photo?.id]);

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

  // Ordinateur : molette (ou pincement du trackpad) = zoom autour du pointeur.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const r = frameRef.current?.getBoundingClientRect();
      if (!r) return;
      e.preventDefault();
      const z = zoomRef.current;
      const s = Math.min(MAX_ZOOM, Math.max(1, z.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002))));
      if (s === z.s) return;
      const cx = e.clientX - (r.left + r.width / 2);
      const cy = e.clientY - (r.top + r.height / 2);
      const k = s / z.s;
      const mx = ((s - 1) * r.width) / 2;
      const my = ((s - 1) * r.height) / 2;
      const x = cx - (cx - z.x) * k;
      const y = cy - (cy - z.y) * k;
      setZooming(false);
      setZoom(s <= 1.01 ? NO_ZOOM : { s, x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

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
  /** Garde la photo zoomée dans son cadre (pas de bord vide au-delà de la photo). */
  const clampZoom = (z: Zoom): Zoom => {
    const s = Math.min(MAX_ZOOM, Math.max(1, z.s));
    const mx = ((s - 1) * frameW) / 2;
    const my = ((s - 1) * frameH) / 2;
    return { s, x: Math.min(mx, Math.max(-mx, z.x)), y: Math.min(my, Math.max(-my, z.y)) };
  };
  /** Point de l'écran → position par rapport au centre du cadre de la photo. */
  const fromCenter = (clientX: number, clientY: number) => {
    const r = frameRef.current?.getBoundingClientRect();
    return r ? { cx: clientX - (r.left + r.width / 2), cy: clientY - (r.top + r.height / 2) } : { cx: 0, cy: 0 };
  };
  /** Zoome jusqu'à `s` en gardant immobile le point (cx, cy) sous le doigt / la souris. */
  const zoomAt = (from: Zoom, s: number, cx: number, cy: number) => {
    const k = s / from.s;
    return clampZoom({ s, x: cx - (cx - from.x) * k, y: cy - (cy - from.y) * k });
  };
  const toggleZoomAt = (clientX: number, clientY: number) => {
    setZooming(false);
    const { cx, cy } = fromCenter(clientX, clientY);
    setZoom(zoomRef.current.s > 1.01 ? NO_ZOOM : zoomAt(NO_ZOOM, TAP_ZOOM, cx, cy));
  };

  const slideClass = direction === 1 ? "animate-[slideFromRight_0.45s_ease-out_both]" : direction === -1 ? "animate-[slideFromLeft_0.45s_ease-out_both]" : "";

  return (
    <div
      className="fixed inset-0 z-50 protect select-none"
      role="dialog"
      aria-modal="true"
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: "none" }}
      onTouchStart={(e) => {
        // Un appui sur un bouton (cœur, téléchargement, fermer) n'est pas un geste sur la photo.
        if ((e.target as HTMLElement).closest("button, a")) {
          touch.current = null;
          return;
        }
        if (e.touches.length === 2) {
          // Pincement : zoom autour du point entre les deux doigts.
          const [a, b] = [e.touches[0], e.touches[1]];
          const { cx, cy } = fromCenter((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
          const z = zoomRef.current;
          pinch.current = { d: dist(a, b), s: z.s, x: z.x, y: z.y, cx, cy };
          pan.current = null;
          touch.current = null;
          setDragX(0);
          setZooming(true);
          return;
        }
        const t = e.touches[0];
        if (zoomRef.current.s > 1.01) {
          pan.current = { px: t.clientX, py: t.clientY, x: zoomRef.current.x, y: zoomRef.current.y };
          setZooming(true);
        }
        touch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
      }}
      onTouchMove={(e) => {
        const p = pinch.current;
        if (p && e.touches.length >= 2) {
          const s = Math.min(MAX_ZOOM * 1.15, Math.max(0.85, (p.s * dist(e.touches[0], e.touches[1])) / p.d));
          const k = s / p.s;
          const mid = fromCenter((e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2);
          // Le point pincé suit les doigts (zoom + déplacement en même temps).
          setZoom({ s, x: mid.cx - (p.cx - p.x) * k, y: mid.cy - (p.cy - p.y) * k });
          return;
        }
        if (pan.current && e.touches.length === 1) {
          const t = e.touches[0];
          setZoom((z) => clampZoom({ s: z.s, x: pan.current!.x + t.clientX - pan.current!.px, y: pan.current!.y + t.clientY - pan.current!.py }));
          return;
        }
        if (!touch.current || e.touches.length > 1) return;
        const dx = e.touches[0].clientX - touch.current.x;
        const dy = e.touches[0].clientY - touch.current.y;
        if (Math.abs(dx) > Math.abs(dy)) setDragX(dx);
      }}
      onTouchEnd={(e) => {
        if (pinch.current) {
          if (e.touches.length < 2) {
            pinch.current = null;
            setZooming(false);
            setZoom((z) => (z.s < 1.05 ? NO_ZOOM : clampZoom(z)));
          }
          return;
        }
        const start = touch.current;
        const wasPanning = Boolean(pan.current);
        touch.current = null;
        pan.current = null;
        setZooming(false);
        setDragX(0);
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        const tap = Math.abs(dx) < 8 && Math.abs(dy) < 8 && Date.now() - start.t < 250;
        if (tap) {
          // Double-tap : zoom / dézoom à cet endroit.
          const last = lastTap.current;
          if (last && Date.now() - last.t < 320 && Math.hypot(t.clientX - last.x, t.clientY - last.y) < 30) {
            lastTap.current = null;
            touchZoomAt.current = Date.now();
            e.preventDefault();
            toggleZoomAt(t.clientX, t.clientY);
            return;
          }
          lastTap.current = { t: Date.now(), x: t.clientX, y: t.clientY };
          setChrome((c) => !c);
          return;
        }
        // Photo zoomée : le doigt déplace la photo, il ne change pas de photo.
        if (wasPanning || zoomRef.current.s > 1.01) return;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
        else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) close();
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
                  style={{
                    transform: zoomed || zooming ? `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})` : undefined,
                    transition: zooming ? "none" : `transform 0.3s ${EASE}, opacity 0.5s`,
                    cursor: zoomed ? "grab" : "zoom-in",
                  }}
                  onDoubleClick={(e) => {
                    if (Date.now() - touchZoomAt.current < 600) return;
                    toggleZoomAt(e.clientX, e.clientY);
                  }}
                  onMouseDown={(e) => {
                    if (!zoomed || e.button !== 0) return;
                    e.preventDefault();
                    const start = { px: e.clientX, py: e.clientY, x: zoom.x, y: zoom.y };
                    setZooming(true);
                    const move = (ev: MouseEvent) => setZoom((z) => clampZoom({ s: z.s, x: start.x + ev.clientX - start.px, y: start.y + ev.clientY - start.py }));
                    const up = () => {
                      setZooming(false);
                      window.removeEventListener("mousemove", move);
                      window.removeEventListener("mouseup", up);
                    };
                    window.addEventListener("mousemove", move);
                    window.addEventListener("mouseup", up);
                  }}
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
