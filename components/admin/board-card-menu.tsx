"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteBoard, duplicateBoard, setBoardCover, updateBoard } from "@/app/admin/board-actions";
import { makeBoardImage } from "@/lib/client/image";
import { DotsIcon } from "@/components/icons";
import { deleteInBackground, useHidden } from "./background";

/** Menu ⋯ d'un tableau dans la liste : renommer, dupliquer, supprimer. */
export function BoardCardMenu({ id, title, hasCover, className = "top-2 right-2" }: { id: string; title: string; hasCover?: boolean; className?: string }) {
  const coverInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());
  // Tableau en cours de mise à la corbeille : sa vignette disparaît tout de suite de la liste.
  const box = useRef<HTMLDivElement>(null);
  const isHidden = useHidden().has(id);
  useEffect(() => {
    const li = box.current?.closest("li");
    if (li) li.style.display = isHidden ? "none" : "";
  }, [isHidden]);

  async function rename() {
    setOpen(false);
    const name = prompt("Nouveau nom du tableau", title)?.trim();
    if (!name || name === title) return;
    setBusy("Renommage…");
    const res = await updateBoard(id, { title: name });
    setBusy(null);
    if (res.error) alert(res.error);
    else refresh();
  }

  async function duplicate() {
    setOpen(false);
    const name = prompt("Nom de la copie", `${title} (copie)`)?.trim();
    if (name === undefined || name === "") return;
    setBusy("Copie en cours…");
    const res = await duplicateBoard(id, name);
    setBusy(null);
    if (res.error) alert(res.error);
    else refresh();
  }

  /** Couverture : image envoyée directement vers le stockage, puis enregistrée. */
  async function uploadCover(file: File) {
    setBusy("Couverture…");
    try {
      const img = await makeBoardImage(file);
      const res = await fetch(`/api/admin/boards/${id}/cover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: img.blob.size }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      const put = await fetch(json.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: img.blob });
      if (!put.ok) throw new Error(`Envoi refusé (${put.status})`);
      const saved = await setBoardCover(id, { key: json.key, size: img.blob.size });
      if (saved.error) throw new Error(saved.error);
      refresh();
    } catch (e) {
      alert(`Couverture non enregistrée : ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  }

  async function removeCover() {
    setOpen(false);
    setBusy("Couverture…");
    const res = await setBoardCover(id, null);
    setBusy(null);
    if (res.error) alert(res.error);
    else refresh();
  }

  async function remove() {
    setOpen(false);
    if (!confirm(`Mettre le tableau « ${title} » à la corbeille ? Vous pourrez le restaurer pendant 30 jours.`)) return;
    deleteInBackground([id], () => deleteBoard(id, { stay: true }), refresh);
  }

  return (
    <div ref={box} className={`absolute ${open ? "z-[60]" : "z-10"} ${className}`}>
      <input
        ref={coverInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void uploadCover(f);
        }}
      />
      {busy ? (
        <span className="block px-3 py-1.5 bg-bg/90 border border-line text-[11px] text-muted">{busy}</span>
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-9 h-9 flex items-center justify-center bg-bg/90 border border-line text-muted hover:text-ink"
          aria-label={`Options du tableau ${title}`}
        >
          <DotsIcon />
        </button>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 w-48 bg-bg-soft border border-line py-1 shadow-xl text-sm">
            <button className="block w-full text-left px-4 py-3 hover:bg-bg" onClick={rename}>Renommer</button>
            <button className="block w-full text-left px-4 py-3 hover:bg-bg" onClick={duplicate}>Dupliquer</button>
            <button
              className="block w-full text-left px-4 py-3 hover:bg-bg"
              onClick={() => {
                setOpen(false);
                coverInput.current?.click();
              }}
            >
              Choisir une couverture
            </button>
            {hasCover && (
              <button className="block w-full text-left px-4 py-3 hover:bg-bg" onClick={removeCover}>
                Retirer la couverture
              </button>
            )}
            <button className="block w-full text-left px-4 py-3 text-danger hover:bg-bg" onClick={remove}>Supprimer</button>
          </div>
        </>
      )}
    </div>
  );
}
