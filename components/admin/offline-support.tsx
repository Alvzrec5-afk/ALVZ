"use client";

import { useEffect } from "react";
import { clearSnapshots } from "@/components/board/offline-store";
import { flushOrphans } from "@/components/board/sync";

const HOURS = 3600_000;

/** Demande au service worker (public/sw.js) de garder ces pages et leurs photos, au plus une fois par `every` ms et par clé. */
export function warmOffline(key: string, pages: string[], every: number) {
  try {
    const sw = navigator.serviceWorker?.controller;
    if (!sw || !navigator.onLine) return;
    const k = `alvz-warm:${key}`;
    const last = Number(localStorage.getItem(k) || 0);
    if (Date.now() - last < every) return;
    localStorage.setItem(k, String(Date.now()));
    sw.postMessage({ type: "warm", pages });
  } catch {}
}

/**
 * Studio utilisable hors connexion : installe le service worker et garde l'Accueil et la liste des tableaux
 * (pour que l'application s'ouvre même sans réseau). Les tableaux eux-mêmes sont gardés par `BoardOffline` ;
 * les modifications faites hors connexion repartent dès le retour du réseau (`flushOrphans`).
 */
export function OfflineSupport() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(() => setTimeout(() => warmOffline("studio", ["/admin", "/admin/boards"], 6 * HOURS), 4000))
      .catch(() => {});
  }, []);
  // Planches modifiées hors connexion puis quittées : envoyées dès que le studio est ouvert avec du réseau.
  useEffect(() => {
    const send = () => void flushOrphans();
    send();
    window.addEventListener("online", send);
    return () => window.removeEventListener("online", send);
  }, []);
  return null;
}

/**
 * Tableau ouvert avec du réseau : on garde sur l'appareil toutes les planches de son projet et leurs photos
 * (une fois toutes les 6 h par projet), et la planche ouverte elle-même si sa copie a plus de 30 min.
 */
export function BoardOffline({ rootId, current, pages }: { rootId: string; current: string; pages: string[] }) {
  useEffect(() => {
    const t = setTimeout(() => {
      warmOffline(`project:${rootId}`, pages, 6 * HOURS);
      warmOffline(`page:${current}`, [current], HOURS / 2);
    }, 3000);
    return () => clearTimeout(t);
  }, [rootId, current, pages]);
  return null;
}

/** Déconnexion : les copies des pages et des photos sont effacées de l'appareil. */
export function clearOffline() {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "clear" });
    void clearSnapshots();
    for (const k of Object.keys(localStorage)) if (k.startsWith("alvz-warm:")) localStorage.removeItem(k);
  } catch {}
}
