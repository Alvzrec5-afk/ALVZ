"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/admin/actions";

export type GalleryFormValues = {
  title: string;
  event_date: string;
  expires_at: string;
  watermark: boolean;
  downloads_enabled: boolean;
  theme: "light" | "dark";
  hasPassword: boolean;
};

export function GalleryForm({
  action,
  values,
  submitLabel,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  values: GalleryFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-10 max-w-xl">
      <div>
        <label className="label" htmlFor="title">Nom du client</label>
        <input id="title" name="title" className="field display text-2xl" required defaultValue={values.title} placeholder="Camille & Hugo" />
      </div>
      <div className="grid sm:grid-cols-2 gap-10">
        <div>
          <label className="label" htmlFor="event_date">Date de l&apos;événement</label>
          <input id="event_date" name="event_date" type="date" className="field" defaultValue={values.event_date} />
        </div>
        <div>
          <label className="label" htmlFor="expires_at">Expire le (optionnel)</label>
          <input id="expires_at" name="expires_at" type="date" className="field" defaultValue={values.expires_at} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="password">
          {values.hasPassword ? "Nouveau mot de passe (laisser vide pour garder l'actuel)" : "Mot de passe (optionnel)"}
        </label>
        <input id="password" name="password" type="text" autoComplete="off" className="field" placeholder={values.hasPassword ? "••••••" : "Aucun"} />
        {values.hasPassword && (
          <label className="mt-3 flex items-center gap-3 text-sm text-muted">
            <input type="checkbox" name="remove_password" /> Retirer le mot de passe
          </label>
        )}
      </div>
      <fieldset className="space-y-4">
        <legend className="label mb-3">Options</legend>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="watermark" defaultChecked={values.watermark} /> Filigrane ALVZ.REC sur les aperçus
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="downloads_enabled" defaultChecked={values.downloads_enabled} /> Autoriser le téléchargement HD
        </label>
        <div className="flex items-center gap-6 text-sm pt-2">
          <span className="text-muted">Ambiance</span>
          <label className="flex items-center gap-2">
            <input type="radio" name="theme" value="light" defaultChecked={values.theme === "light"} /> Claire
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="theme" value="dark" defaultChecked={values.theme === "dark"} /> Sombre
          </label>
        </div>
      </fieldset>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p className="text-sm">{state.ok}</p>}
      <button className="btn" disabled={pending}>{pending ? "Enregistrement…" : submitLabel}</button>
    </form>
  );
}
