"use client";

import { useActionState } from "react";
import { saveContact } from "@/app/admin/actions";
import type { Contact } from "@/lib/contact";

const FIELDS: { name: keyof Contact; label: string; placeholder: string; type?: string; hint?: string }[] = [
  { name: "name", label: "Nom affiché", placeholder: "ALVZ.REC — Photo & vidéo" },
  { name: "tagline", label: "Petite phrase", placeholder: "Mariages, portraits, événements. Disponible partout en France." },
  { name: "whatsapp", label: "WhatsApp (numéro)", placeholder: "06 12 34 56 78", type: "tel", hint: "Format français accepté : il est converti automatiquement pour WhatsApp." },
  { name: "instagram", label: "Instagram", placeholder: "alvz.rec", hint: "Votre nom d'utilisateur, sans @ (ou le lien de votre profil)." },
  { name: "tiktok", label: "TikTok", placeholder: "alvz.rec", hint: "Votre nom d'utilisateur, sans @ (ou le lien de votre profil)." },
  { name: "email", label: "E-mail", placeholder: "contact@alvzgalleries.com", type: "email" },
  { name: "website", label: "Site web", placeholder: "alvzgalleries.com" },
];

export function ContactForm({ contact }: { contact: Contact }) {
  const [state, action, pending] = useActionState(saveContact, null);
  return (
    <form action={action} className="space-y-8">
      {FIELDS.map((f) => (
        <div key={f.name}>
          <label className="label" htmlFor={f.name}>{f.label}</label>
          <input id={f.name} name={f.name} type={f.type ?? "text"} defaultValue={contact[f.name] ?? ""} placeholder={f.placeholder} className="field" autoComplete="off" />
          {f.hint && <p className="text-xs text-muted mt-2">{f.hint}</p>}
        </div>
      ))}
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p className="text-sm text-accent">{state.ok}</p>}
      <button className="btn" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</button>
      <p className="text-xs text-muted">Pour masquer cette carte sur une galerie précise : ☰ → Paramètres → Carte de visite.</p>
    </form>
  );
}
