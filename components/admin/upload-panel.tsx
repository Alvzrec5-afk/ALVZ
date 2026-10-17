"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { filesFromDrop, filesFromInput } from "@/lib/client/files";
import { Uploader } from "@/lib/client/uploader";

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} Mo`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} Go`;
}

export function UploadPanel({ galleryId, defaultCollection }: { galleryId: string; defaultCollection: string }) {
  const router = useRouter();
  const [uploader] = useState(() => new Uploader(galleryId, () => router.refresh()));
  const items = useSyncExternalStore(uploader.subscribe, uploader.getSnapshot, uploader.getSnapshot);
  const [over, setOver] = useState(false);
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const busy = items.some((i) => i.status === "queued" || i.status === "working");

  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "");
  }, []);

  const done = items.filter((i) => i.status === "done").length;
  const dupes = items.filter((i) => i.status === "duplicate").length;
  const errors = items.filter((i) => i.status === "error");
  const working = items.filter((i) => i.status === "working");
  const total = items.reduce((s, i) => s + i.total, 0);
  const loaded = items.reduce((s, i) => s + (i.status === "done" || i.status === "duplicate" ? i.total : i.loaded), 0);
  const pct = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;

  return (
    <div className="mb-12">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setOver(false);
          uploader.add(await filesFromDrop(e.dataTransfer), defaultCollection);
        }}
        className={`border border-dashed px-6 py-12 text-center transition-colors ${over ? "border-ink bg-bg-soft" : "border-line"}`}
      >
        <p className="display text-2xl">Glissez vos photos ou dossiers ici</p>
        <p className="text-xs text-muted mt-3 max-w-md mx-auto leading-relaxed">
          Chaque dossier devient une collection. Les photos seules vont dans « {defaultCollection} ».
          Les doublons sont ignorés automatiquement.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button className="btn btn-ghost" onClick={() => filesInput.current?.click()}>Choisir des photos</button>
          <button className="btn btn-ghost" onClick={() => folderInput.current?.click()}>Choisir un dossier</button>
        </div>
        <input
          ref={filesInput}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif"
          hidden
          onChange={(e) => {
            if (e.target.files) uploader.add(filesFromInput(e.target.files), defaultCollection);
            e.target.value = "";
          }}
        />
        <input
          ref={folderInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) uploader.add(filesFromInput(e.target.files), defaultCollection);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="mt-6 border border-line p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3 text-sm">
            <span>
              {busy ? "Envoi en cours" : "Envoi terminé"} — {done + dupes}/{items.length} photos
              {dupes > 0 && <span className="text-muted"> · {dupes} doublon{dupes > 1 ? "s" : ""} ignoré{dupes > 1 ? "s" : ""}</span>}
              {errors.length > 0 && <span className="text-danger"> · {errors.length} échec{errors.length > 1 ? "s" : ""}</span>}
            </span>
            <span className="text-muted text-xs">{formatBytes(loaded)} / {formatBytes(total)} · {pct}%</span>
          </div>
          <div className="mt-3 h-px bg-line relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-ink transition-[width] duration-300" style={{ width: `${pct}%`, height: 2, top: -0.5 }} />
          </div>
          {working.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-muted">
              {working.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span className="truncate">{i.collection} / {i.file.name}</span>
                  <span className="shrink-0">{i.step}{i.step === "Envoi" && i.total ? ` ${Math.round((i.loaded / i.total) * 100)}%` : ""}</span>
                </li>
              ))}
            </ul>
          )}
          {errors.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-danger">
              {errors.slice(0, 8).map((i) => (
                <li key={i.id} className="truncate">{i.file.name} — {i.error}</li>
              ))}
              {errors.length > 8 && <li>… et {errors.length - 8} autres</li>}
            </ul>
          )}
          <div className="mt-4 flex gap-3">
            {errors.length > 0 && !busy && <button className="btn btn-ghost" onClick={() => uploader.retryFailed()}>Réessayer les échecs</button>}
            {!busy && <button className="btn btn-ghost" onClick={() => uploader.clearFinished()}>Effacer la liste</button>}
          </div>
          {busy && <p className="mt-4 text-xs text-muted">Gardez cette page ouverte. En cas de coupure réseau, l&apos;envoi reprend tout seul.</p>}
        </div>
      )}
    </div>
  );
}
