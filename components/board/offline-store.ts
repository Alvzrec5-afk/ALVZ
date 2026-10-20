/**
 * Dernière version de chaque tableau vue sur cet appareil (IndexedDB : bien plus de place que localStorage),
 * pour le rouvrir sans réseau tel qu'on l'a laissé, même si la copie de la page gardée est plus ancienne.
 */
import type { BoardItem } from "@/lib/board-types";

export type BoardSnapshot = { savedAt: number; items: BoardItem[] };

const DB = "alvz-boards";
const STORE = "snapshots";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadSnapshot(key: string): Promise<BoardSnapshot | null> {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as BoardSnapshot | undefined) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveSnapshot(key: string, snap: BoardSnapshot) {
  try {
    const db = await open();
    db.transaction(STORE, "readwrite").objectStore(STORE).put(snap, key);
  } catch {}
}

/** Déconnexion : tout est effacé de l'appareil. */
export async function clearSnapshots() {
  try {
    const db = await open();
    db.transaction(STORE, "readwrite").objectStore(STORE).clear();
  } catch {}
}
