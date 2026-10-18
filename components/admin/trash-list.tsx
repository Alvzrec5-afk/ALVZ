"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { purgeTrashedBoard, restoreFromTrash } from "@/app/admin/board-actions";
import { BoardIcon, FilmIcon, ImageIcon } from "@/components/icons";
import { formatBytes } from "@/lib/format";
import { purge } from "./purge";

export type TrashEntry = { kind: "gallery" | "video" | "board"; id: string; title: string; deletedAt: string; bytes: number };

const KEEP_DAYS = 30;
const SECTIONS = [
  { kind: "gallery", label: "Galeries", Icon: ImageIcon },
  { kind: "video", label: "Projets vidéo", Icon: FilmIcon },
  { kind: "board", label: "Tableaux", Icon: BoardIcon },
] as const;

const daysLeft = (e: TrashEntry) => KEEP_DAYS - Math.floor((Date.now() - new Date(e.deletedAt).getTime()) / 86_400_000);

/** Corbeille : restaurer ou supprimer définitivement ; au-delà de 30 jours, effacement automatique. */
export function TrashList({ entries }: { entries: TrashEntry[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const cleaned = useRef(false);
  const visible = entries.filter((e) => !gone.has(e.id));

  async function erase(e: TrashEntry) {
    if (e.kind === "board") {
      const res = await purgeTrashedBoard(e.id);
      if (res.error) throw new Error(res.error);
    } else await purge("gallery", e.id); // photos, vidéos et fichiers, par lots
    setGone((g) => new Set(g).add(e.id));
  }

  // Effacement automatique de ce qui est dans la corbeille depuis plus de 30 jours.
  useEffect(() => {
    if (cleaned.current) return;
    cleaned.current = true;
    const expired = entries.filter((e) => daysLeft(e) <= 0);
    if (!expired.length) return;
    void (async () => {
      setBusy("Nettoyage des éléments de plus de 30 jours…");
      for (const e of expired) await erase(e).catch(() => undefined);
      setBusy(null);
      startTransition(() => router.refresh());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function restore(e: TrashEntry) {
    setBusy(`Restauration de « ${e.title} »…`);
    const res = await restoreFromTrash(e.kind === "board" ? "board" : "gallery", e.id);
    setBusy(null);
    if (res.error) return alert(res.error);
    setGone((g) => new Set(g).add(e.id));
    startTransition(() => router.refresh());
  }

  async function eraseNow(e: TrashEntry) {
    if (!confirm(`Supprimer définitivement « ${e.title} » ? Cette fois, ce sera impossible à récupérer.`)) return;
    setBusy(`Suppression de « ${e.title} »…`);
    try {
      await erase(e);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
    setBusy(null);
    startTransition(() => router.refresh());
  }

  async function emptyAll() {
    if (!confirm(`Vider la corbeille ? Les ${visible.length} éléments seront supprimés définitivement.`)) return;
    for (const e of visible) {
      setBusy(`Suppression de « ${e.title} »…`);
      await erase(e).catch(() => undefined);
    }
    setBusy(null);
    startTransition(() => router.refresh());
  }

  const total = visible.reduce((n, e) => n + e.bytes, 0);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl">Corbeille</h1>
          <p className="text-sm text-muted mt-3 max-w-lg leading-relaxed">
            Galeries, projets vidéo et tableaux supprimés. Restaurez-les tant qu&apos;ils sont ici : ils sont effacés pour de bon
            après {KEEP_DAYS} jours.
            {total > 0 && ` Ils occupent encore ${formatBytes(total)} de stockage.`}
          </p>
        </div>
        {visible.length > 0 && (
          <button className="btn btn-ghost shrink-0" onClick={emptyAll} disabled={Boolean(busy)}>
            Vider
          </button>
        )}
      </div>
      {busy && <p className="mt-6 text-sm text-muted">{busy}</p>}

      {visible.length === 0 ? (
        <p className="mt-14 text-sm text-muted border border-dashed border-line py-16 text-center">La corbeille est vide.</p>
      ) : (
        SECTIONS.map(({ kind, label, Icon }) => {
          const list = visible.filter((e) => e.kind === kind);
          if (!list.length) return null;
          return (
            <section key={kind} className="mt-12">
              <p className="eyebrow text-muted mb-2">{label}</p>
              <ul>
                {list.map((e) => (
                  <li key={e.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-3 py-4 border-b border-line">
                    <Icon className="w-5 h-5 text-muted shrink-0" />
                    <div className="flex-1 min-w-0 basis-[calc(100%-2.25rem)] sm:basis-0">
                      <p className="text-[15px] truncate">{e.title}</p>
                      <p className="text-xs text-muted mt-0.5">
                        Supprimé le {new Date(e.deletedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} ·{" "}
                        {daysLeft(e) > 1 ? `encore ${daysLeft(e)} jours` : "effacé aujourd'hui"}
                        {e.bytes > 0 && ` · ${formatBytes(e.bytes)}`}
                      </p>
                    </div>
                    <button className="btn shrink-0 ml-9 sm:ml-0" onClick={() => restore(e)} disabled={Boolean(busy)}>
                      Restaurer
                    </button>
                    <button
                      className="shrink-0 text-xs text-muted hover:text-danger px-2"
                      onClick={() => eraseNow(e)}
                      disabled={Boolean(busy)}
                      title="Supprimer définitivement"
                    >
                      <span className="hidden sm:inline">Supprimer définitivement</span>
                      <span className="sm:hidden">Effacer</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
