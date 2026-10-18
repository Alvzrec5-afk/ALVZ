"use client";

import { useActionState, useState } from "react";
import { createBoard } from "@/app/admin/board-actions";
import { TEMPLATES, TEMPLATE_HINTS, type TemplateId } from "@/lib/board-types";

export function CreateBoardForm({ galleries, defaultGallery }: { galleries: { id: string; title: string; kind: string }[]; defaultGallery: string }) {
  const [state, formAction, pending] = useActionState(createBoard, null);
  const [template, setTemplate] = useState<TemplateId>("moodboard");
  return (
    <form action={formAction} className="space-y-10 max-w-xl">
      <div>
        <label className="label" htmlFor="title">Nom du tableau</label>
        <input id="title" name="title" className="field display text-2xl" required autoFocus placeholder="Moodboard — Camille & Hugo" />
      </div>
      <div>
        <p className="label mb-3">Modèle</p>
        <input type="hidden" name="template" value={template} />
        <div className="grid sm:grid-cols-2 gap-2">
          {(Object.keys(TEMPLATES) as TemplateId[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTemplate(t)}
              className={`text-left border px-4 py-3.5 transition-colors ${template === t ? "border-ink" : "border-line hover:border-muted"}`}
            >
              <span className="block text-[15px]">{template === t ? "✓ " : ""}{TEMPLATES[t]}</span>
              <span className="block text-xs text-muted mt-1">{TEMPLATE_HINTS[t]}</span>
            </button>
          ))}
        </div>
      </div>
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
