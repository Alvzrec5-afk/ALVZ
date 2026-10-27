"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PhotoView } from "@/lib/types";
import { ChevronLeft, ChevronRight, CloseIcon, HeartIcon, TrashIcon } from "@/components/icons";

/** Visionneuse du studio : voir une photo en grand, la supprimer (petite poubelle en haut). La couverture se choisit dans Design → Couverture. */
export function AdminViewer({
  photos,
  index,
  onIndex,
  onClose,
  coverId,
  favoriteCounts,
  downloadCounts,
  onDelete,
}: {
  photos: PhotoView[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  coverId: string | null;
  favoriteCounts: Record<string, number>;
  downloadCounts: Record<string, number>;
  onDelete: (photo: PhotoView) => Promise<void>;
}) {
  const photo = photos[index];
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

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
  useEffect(() => {
    [photos[index + 1], photos[index - 1]].forEach((p) => {
      if (p) new Image().src = p.web;
    });
  }, [index, photos]);

  if (!photo) return null;
  const isCover = photo.id === coverId;
  const favs = favoriteCounts[photo.id] ?? 0;
  const dls = downloadCounts[photo.id] ?? 0;

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-bg flex flex-col select-none"
      role="dialog"
      aria-modal="true"
      onTouchStart={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
        else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
      }}
    >
      <div className="flex items-center gap-3 px-3 sm:px-6 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <div className="flex-1 min-w-0 pl-2">
          <p className="text-sm truncate">{photo.filename}</p>
          <p className="text-xs text-muted flex items-center gap-2">
            {index + 1} / {photos.length}
            {isCover && <span>· Couverture</span>}
            {favs > 0 && (
              <span className="flex items-center gap-1">
                · <HeartIcon className="w-3 h-3" filled /> {favs}
              </span>
            )}
            {dls > 0 && <span>· ↓ {dls} téléchargement{dls > 1 ? "s" : ""}</span>}
          </p>
        </div>
        <button
          className="icon-btn hover:text-danger"
          disabled={busy}
          title="Supprimer la photo"
          aria-label="Supprimer la photo"
          onClick={() => {
            if (confirm(`Supprimer définitivement ${photo.filename} ?`)) act(() => onDelete(photo));
          }}
        >
          <TrashIcon />
        </button>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer">
          <CloseIcon />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center px-0 sm:px-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.web}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(true)}
          className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
        {index > 0 && (
          <button className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 icon-btn w-12 h-12" onClick={prev} aria-label="Précédente">
            <ChevronLeft />
          </button>
        )}
        {index < photos.length - 1 && (
          <button className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 icon-btn w-12 h-12" onClick={next} aria-label="Suivante">
            <ChevronRight />
          </button>
        )}
      </div>

      <div className="pb-[env(safe-area-inset-bottom)]" />
    </div>
  );
}
