"use client";

import { useState, useTransition } from "react";
import { calendarFeedUrl } from "@/app/admin/calendar-actions";

/** Abonnement du Calendrier de l'iPhone / du Mac / Google Agenda au calendrier du studio. */
export function SyncButton() {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function load(renew = false) {
    start(async () => {
      const r = await calendarFeedUrl(renew);
      if (r.error || !r.url) return setError(r.error ?? "Lien indisponible");
      setUrl(r.url);
      setOpen(true);
    });
  }

  return (
    <>
      <button className="btn btn-ghost" disabled={busy} onClick={() => (url ? setOpen(true) : load())}>
        {busy ? "…" : "Sur mon iPhone"}
      </button>
      {open && url && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:max-w-md bg-bg border border-line p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-5 animate-[fadeUp_0.2s_ease-out_both]">
            <h2 className="display text-2xl">Calendrier sur l&apos;iPhone et le Mac</h2>
            <p className="text-sm text-muted leading-relaxed">
              Une seule fois : vos prestations, options, rendez-vous et soldes à recevoir apparaîtront dans l&apos;app Calendrier et se mettront à
              jour toutes seules (en général dans l&apos;heure).
            </p>
            <a className="btn w-full" href={url.replace(/^https:/, "webcal:")}>S&apos;abonner sur cet appareil</a>
            <div className="text-xs text-muted leading-relaxed space-y-2">
              <p>
                <b className="text-ink font-medium">Sur Mac</b> : Calendrier → Fichier → Nouvel abonnement au calendrier → collez le lien.
                <br />
                <b className="text-ink font-medium">Google Agenda</b> : Autres agendas → + → À partir de l&apos;URL.
              </p>
              <div className="flex gap-2 items-center">
                <input className="field text-xs flex-1" readOnly value={url} onFocus={(e) => e.target.select()} />
                <button
                  className="shrink-0 hover:text-ink"
                  onClick={async () => {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? "Copié ✓" : "Copier"}
                </button>
              </div>
              <p>Ce lien est secret : ne le partagez pas. Si besoin, <button className="underline" onClick={() => { if (confirm("Créer un nouveau lien ? L'ancien abonnement cessera de se mettre à jour.")) load(true); }}>créez-en un nouveau</button>.</p>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button className="btn btn-ghost w-full" onClick={() => setOpen(false)}>Fermer</button>
          </div>
        </div>
      )}
      {error && !open && <span className="text-xs text-danger self-center">{error}</span>}
    </>
  );
}
