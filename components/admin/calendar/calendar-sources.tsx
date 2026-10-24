"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCalendarSource, deleteCalendarSource } from "@/app/admin/calendar-actions";
import { PlusIcon, TrashIcon } from "@/components/icons";

export type CalendarSourceInfo = { id: string; name: string; count: number; error: string | null };

/** Calendriers de l'iPhone (iCloud) ou de Google affichés dans le calendrier du studio (lecture seule). */
export function CalendarSources({ sources }: { sources: CalendarSourceInfo[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [help, setHelp] = useState<"iphone" | "google" | null>("iphone");
  const [notice, setNotice] = useState<{ ok?: string; error?: string } | null>(null);
  const [busy, start] = useTransition();

  function add() {
    start(async () => {
      const r = await addCalendarSource(name, url);
      setNotice(r);
      if (!r.error) {
        setName("");
        setUrl("");
        setAdding(false);
        router.refresh();
      }
    });
  }

  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="eyebrow text-muted">Calendriers importés</h3>
        {!adding && (
          <button className="text-xs text-muted hover:text-ink flex items-center gap-1" onClick={() => setAdding(true)}>
            <PlusIcon className="w-3.5 h-3.5" /> Ajouter mon calendrier iPhone ou Google
          </button>
        )}
      </div>
      <p className="text-xs text-muted leading-relaxed mb-4 max-w-2xl">
        Ce que vous ajoutez dans ces calendriers apparaît ici (en bleu) quelques minutes plus tard. Touchez un de ces événements pour en faire
        un événement du studio (option, galerie, vidéo, tableau, devis…). Dans ce sens seulement : le studio ne modifie pas votre iPhone.
      </p>

      {sources.length > 0 && (
        <ul className="mb-4">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center gap-4 py-3 border-b border-line text-sm">
              <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "var(--series-1)" }} />
              <span className="flex-1 min-w-0">
                <span className="block truncate">{s.name}</span>
                <span className={`block text-xs ${s.error ? "text-danger" : "text-muted"}`}>
                  {s.error ?? `${s.count} événement${s.count > 1 ? "s" : ""} (2 mois passés → 1 an à venir)`}
                </span>
              </span>
              <button
                className="icon-btn"
                aria-label="Retirer ce calendrier"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Ne plus afficher « ${s.name} » ? (Votre calendrier iPhone / Google n'est pas touché.)`))
                    start(async () => {
                      await deleteCalendarSource(s.id);
                      router.refresh();
                    });
                }}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="border border-line p-5 space-y-5">
          <div className="flex gap-2">
            {(["iphone", "google"] as const).map((k) => (
              <button key={k} onClick={() => setHelp(k)} className={`px-4 py-2 text-xs border ${help === k ? "border-ink" : "border-line text-muted hover:text-ink"}`}>
                {k === "iphone" ? "iPhone (iCloud)" : "Google Agenda"}
              </button>
            ))}
          </div>
          {help === "iphone" ? (
            <ol className="text-xs text-muted leading-relaxed list-decimal pl-4 space-y-1">
              <li>Dans l&apos;app <b className="text-ink font-medium">Calendrier</b>, touchez <b className="text-ink font-medium">Calendriers</b> en bas, puis <b className="text-ink font-medium">Ajouter un calendrier</b> (ex. « ALVZ – Rendez-vous »).</li>
              <li>Touchez le <b className="text-ink font-medium">ⓘ</b> à côté de ce calendrier, activez <b className="text-ink font-medium">Calendrier public</b>, puis <b className="text-ink font-medium">Partager le lien… → Copier</b>.</li>
              <li>Collez le lien ci-dessous. Ensuite, ajoutez vos rendez-vous dans ce calendrier depuis l&apos;iPhone.</li>
              <li className="list-none -ml-4 pt-1">Le lien est impossible à deviner, mais toute personne qui l&apos;a peut voir ce calendrier : ne le partagez pas.</li>
            </ol>
          ) : (
            <ol className="text-xs text-muted leading-relaxed list-decimal pl-4 space-y-1">
              <li>Sur ordinateur, ouvrez <b className="text-ink font-medium">calendar.google.com</b>.</li>
              <li>À gauche, passez sur votre agenda → <b className="text-ink font-medium">⋮ → Paramètres et partage</b>.</li>
              <li>Tout en bas : <b className="text-ink font-medium">Adresse secrète au format iCal</b> → copiez-la et collez-la ci-dessous.</li>
            </ol>
          )}
          <div className="grid sm:grid-cols-[12rem_1fr] gap-5">
            <label className="block">
              <span className="label">Nom</span>
              <input className="field" placeholder={help === "google" ? "Google" : "iPhone"} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </label>
            <label className="block">
              <span className="label">Lien du calendrier</span>
              <input className="field" inputMode="url" placeholder="webcal://… ou https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn" disabled={busy || !url.trim()} onClick={add}>{busy ? "Vérification…" : "Ajouter"}</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => setAdding(false)}>Annuler</button>
          </div>
        </div>
      )}
      {notice?.ok && <p className="text-sm text-accent mt-3">{notice.ok}</p>}
      {notice?.error && <p className="text-sm text-danger mt-3">{notice.error}</p>}
    </section>
  );
}
