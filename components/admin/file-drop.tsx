"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

/**
 * Fichiers glissés depuis l'ordinateur n'importe où sur la page (Finder, Explorateur).
 * Une zone de dépôt qui gère déjà l'événement (preventDefault) a la priorité.
 */
export function useWindowFileDrop(onDrop: (dt: DataTransfer) => void, enabled = true) {
  const [over, setOver] = useState(false);
  const cb = useRef(onDrop);
  cb.current = onDrop;

  useEffect(() => {
    if (!enabled) return;
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    const overFn = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const drop = (e: DragEvent) => {
      depth = 0;
      setOver(false);
      if (!hasFiles(e) || e.defaultPrevented || !e.dataTransfer) return;
      e.preventDefault();
      cb.current(e.dataTransfer);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", overFn);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", overFn);
      window.removeEventListener("drop", drop);
    };
  }, [enabled]);

  return over;
}

/** Voile plein écran pendant qu'on glisse des fichiers au-dessus de la page (dans <body> : visible même si la fenêtre d'envoi est fermée). */
export function DropOverlay({ show, title, hint }: { show: boolean; title: string; hint?: string }) {
  if (!show || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center bg-black/55 p-6">
      <div className="border-2 border-dashed border-white/80 px-10 py-14 text-center text-white max-w-lg w-full">
        <p className="display text-3xl">{title}</p>
        {hint && <p className="text-sm mt-3 text-white/80">{hint}</p>}
      </div>
    </div>,
    document.body,
  );
}
