"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteBoard, duplicateBoard, updateBoard } from "@/app/admin/board-actions";
import { DotsIcon } from "@/components/icons";

/** Menu ⋯ d'un tableau dans la liste : renommer, dupliquer, supprimer. */
export function BoardCardMenu({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

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

  async function remove() {
    setOpen(false);
    if (!confirm(`Mettre le tableau « ${title} » à la corbeille ? Vous pourrez le restaurer pendant 30 jours.`)) return;
    setBusy("Suppression…");
    const res = await deleteBoard(id, { stay: true });
    setBusy(null);
    if (res?.error) alert(res.error);
    else refresh();
  }

  return (
    <div className="absolute top-2 right-2 z-10">
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
            <button className="block w-full text-left px-4 py-3 text-danger hover:bg-bg" onClick={remove}>Supprimer</button>
          </div>
        </>
      )}
    </div>
  );
}
