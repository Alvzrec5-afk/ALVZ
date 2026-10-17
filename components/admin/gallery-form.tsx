"use client";

import { useActionState } from "react";
import { createGallery } from "@/app/admin/actions";

/** Création rapide : le reste (design, options) se règle ensuite dans la galerie. */
export function CreateGalleryForm() {
  const [state, formAction, pending] = useActionState(createGallery, null);
  return (
    <form action={formAction} className="space-y-10 max-w-xl">
      <div>
        <label className="label" htmlFor="title">Nom du client</label>
        <input id="title" name="title" className="field display text-2xl" required autoFocus placeholder="Camille & Hugo" />
      </div>
      <div>
        <label className="label" htmlFor="event_date">Date de l&apos;événement</label>
        <input id="event_date" name="event_date" type="date" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="password">Mot de passe (optionnel)</label>
        <input id="password" name="password" type="text" autoComplete="off" className="field" placeholder="Aucun" />
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Création…" : "Créer la galerie"}</button>
    </form>
  );
}
