"use client";

import { useActionState } from "react";
import { createBoard } from "@/app/admin/board-actions";

export function CreateBoardForm({ galleries, defaultGallery }: { galleries: { id: string; title: string; kind: string }[]; defaultGallery: string }) {
  const [state, formAction, pending] = useActionState(createBoard, null);
  return (
    <form action={formAction} className="space-y-10 max-w-xl">
      <div>
        <label className="label" htmlFor="title">Nom du tableau</label>
        <input id="title" name="title" className="field display text-2xl" required autoFocus placeholder="Projet — Camille & Hugo" />
      </div>
      <p className="text-sm text-muted leading-relaxed -mt-4">
        Le tableau arrive prêt, avec six planches déjà remplies : budget, brief et appels client, moodboard, shot list,
        check-list et timeline du tournage. Supprimez celles qui ne servent pas.
      </p>
      <div>
        <label className="label" htmlFor="gallery_id">Relier à une galerie ou un projet vidéo (optionnel)</label>
        <select id="gallery_id" name="gallery_id" defaultValue={defaultGallery} className="field">
          <option value="">Aucun</option>
          {galleries.map((g) => (
            <option key={g.id} value={g.id}>
              {g.kind === "video" ? "Vidéo · " : ""}{g.title}
            </option>
          ))}
        </select>
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Création…" : "Créer le tableau"}</button>
    </form>
  );
}
