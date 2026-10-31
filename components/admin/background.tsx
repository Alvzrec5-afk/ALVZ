"use client";

/**
 * Suppressions « fluides » : l'élément disparaît tout de suite de l'écran (même après un changement de page),
 * la suppression se fait en arrière-plan. En cas d'échec, il réapparaît et un message s'affiche.
 */
import { useSyncExternalStore } from "react";
import { faceIndexer } from "@/lib/client/face-indexer";

const hidden = new Set<string>();
let pending = 0;
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Identifiants masqués en attendant la fin de leur suppression. */
export function useHidden() {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return hidden;
}

export function usePendingCount() {
  return useSyncExternalStore(subscribe, () => pending, () => 0);
}

/**
 * Masque `ids` immédiatement et lance `task` en arrière-plan.
 * `done` est appelé à la fin (ex. rafraîchir la page) ; en cas d'erreur, les éléments réapparaissent.
 */
export function deleteInBackground(ids: string[], task: () => Promise<unknown>, done?: () => void) {
  ids.forEach((id) => hidden.add(id));
  pending++;
  emit();
  void (async () => {
    try {
      const res = await task();
      const error = res && typeof res === "object" && "error" in res ? (res as { error?: string }).error : undefined;
      if (error) throw new Error(error);
      done?.();
      // La page s'est rafraîchie entre-temps : on retire le masquage (utile si l'élément est restauré plus tard).
      setTimeout(() => {
        ids.forEach((id) => hidden.delete(id));
        emit();
      }, 5000);
    } catch (e) {
      ids.forEach((id) => hidden.delete(id));
      alert(`Suppression impossible : ${e instanceof Error ? e.message : e}`);
      done?.();
    } finally {
      pending--;
      emit();
    }
  })();
}

/** Pastille discrète tant qu'une suppression est en cours (et avertit si on ferme la page). */
export function BackgroundStatus() {
  const n = usePendingCount();
  const faces = useSyncExternalStore(faceIndexer.subscribe, faceIndexer.getSnapshot, faceIndexer.getServerSnapshot);
  if (typeof window !== "undefined") {
    window.onbeforeunload = n > 0 || faces.running ? (e) => e.preventDefault() : null;
  }
  if (!n && faces.running) {
    return (
      <div className="fixed z-[600000] left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),16px)] bg-ink text-bg text-xs px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        Analyse des visages… {faces.done} / {faces.total}
      </div>
    );
  }
  if (!n) return null;
  return (
    <div className="fixed z-[600000] left-1/2 -translate-x-1/2 bottom-[calc(max(env(safe-area-inset-bottom),16px)+var(--tabbar,0px))] lg:bottom-[max(env(safe-area-inset-bottom),16px)] bg-ink text-bg text-xs px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 pointer-events-none">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      Suppression en cours{n > 1 ? ` (${n})` : ""}…
    </div>
  );
}
