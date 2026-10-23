"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { KIND_LABEL, type CalendarEvent, type EventKind } from "@/lib/calendar";
import { formatCents, parseEuros } from "@/lib/finance";
import { confirmEventAction, createEventQuote, deleteEvent, saveEvent, setEventStatus, type EventInput } from "@/app/admin/calendar-actions";
import { Segmented } from "@/components/admin/ui";
import { HoverLink } from "@/components/admin/hover-link";
import { BoardIcon, CloseIcon, FilmIcon, ImageIcon, MoneyIcon } from "@/components/icons";

/** Fenêtre d'un événement : prestation (option → confirmée, projets créés), rendez-vous ou autre. */
export function EventEditor({
  event,
  date,
  onClose,
  onSaved,
}: {
  event?: CalendarEvent;
  date: string;
  onClose: () => void;
  /** Appelé après chaque enregistrement ; `id` = garder la fenêtre ouverte sur cet événement. */
  onSaved: (id?: string) => void;
}) {
  const router = useRouter();
  const [f, setF] = useState({
    kind: (event?.kind ?? "prestation") as EventKind,
    title: event?.title ?? "",
    client_name: event?.client_name ?? "",
    client_email: event?.client_email ?? "",
    starts_on: event?.starts_on ?? date,
    ends_on: event?.ends_on ?? "",
    start_time: event?.start_time?.slice(0, 5) ?? "",
    end_time: event?.end_time?.slice(0, 5) ?? "",
    location: event?.location ?? "",
    notes: event?.notes ?? "",
    want_photo: event?.want_photo ?? false,
    want_video: event?.want_video ?? false,
    want_board: event?.want_board ?? false,
    price: event?.price_cents ? (event.price_cents / 100).toFixed(2).replace(".", ",") : "",
  });
  const [id, setId] = useState(event?.id ?? null);
  const [notice, setNotice] = useState<{ ok?: string; error?: string } | null>(null);
  const [busy, start] = useTransition();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const prestation = f.kind === "prestation";
  const status = event?.status ?? "option";
  const confirmed = status === "confirmed";

  function input(): EventInput | null {
    const price = f.price.trim() ? parseEuros(f.price) : null;
    if (f.price.trim() && (price === null || price < 0)) {
      setNotice({ error: "Prix invalide." });
      return null;
    }
    return { ...f, price_cents: price };
  }

  function save(confirm = false) {
    const data = input();
    if (!data) return;
    if (confirm && prestation && !f.want_photo && !f.want_video && !f.want_board && !confirmed) {
      if (!window.confirm("Rien n'est coché (galerie, vidéo, tableau) : confirmer la date sans rien créer ?")) return;
    }
    start(async () => {
      const r = await saveEvent(id, data, confirm);
      if (r.id) setId(r.id);
      setNotice(r.error ? { error: r.error } : { ok: r.ok });
      onSaved(r.error ? r.id : confirm || id ? r.id : undefined);
    });
  }

  function run(fn: () => Promise<{ error?: string; ok?: string }>, close = false) {
    start(async () => {
      const r = await fn();
      setNotice(r.error ? { error: r.error } : r.ok ? { ok: r.ok } : null);
      onSaved(close ? undefined : id ?? undefined);
      if (close && !r.error) onClose();
    });
  }

  function quote() {
    if (!id) return;
    start(async () => {
      const data = input();
      if (!data) return;
      const saved = await saveEvent(id, data);
      if (saved.error) return setNotice({ error: saved.error });
      const r = await createEventQuote(id);
      if (r.error || !r.id) return setNotice({ error: r.error ?? "Création du devis impossible" });
      router.push(`/admin/finances/devis/${r.id}`);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 animate-[fadeIn_0.2s_ease-out_both]" onClick={onClose} />
      <aside className="relative w-full sm:max-w-lg h-full bg-bg border-l border-line overflow-y-auto pb-[env(safe-area-inset-bottom)] animate-[slideFromRight_0.25s_cubic-bezier(.2,.8,.2,1)_both]">
        <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur-md border-b border-line flex items-center gap-3 px-6 h-16 pt-[env(safe-area-inset-top)] box-content">
          <h2 className="display text-2xl flex-1 truncate">{event ? f.title || "Événement" : "Nouvel événement"}</h2>
          {event && prestation && (
            <span className={`eyebrow text-[10px] px-3 py-1.5 rounded-full ${confirmed ? "bg-accent/15 text-accent" : status === "cancelled" ? "bg-bg-soft text-muted" : "border border-dashed border-muted"}`}>
              {confirmed ? "Confirmé" : status === "cancelled" ? "Annulé" : "Option"}
            </span>
          )}
          <button className="icon-btn -mr-2" onClick={onClose} aria-label="Fermer"><CloseIcon /></button>
        </div>

        <div className="px-6 py-8 space-y-7">
          <Segmented value={f.kind} options={KIND_LABEL} onChange={(v) => set("kind", v)} />

          <L label={prestation ? "Titre (ex. Mariage Léa & Tom)" : "Titre"}>
            <input className="field" autoFocus={!event} value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={200} />
          </L>

          <div className="grid grid-cols-2 gap-5">
            <L label="Date">
              <input className="field" type="date" value={f.starts_on} onChange={(e) => set("starts_on", e.target.value)} />
            </L>
            <L label="Jusqu'au">
              <input className="field" type="date" value={f.ends_on} min={f.starts_on} onChange={(e) => set("ends_on", e.target.value)} />
            </L>
            <L label="Heure de début">
              <input className="field" type="time" value={f.start_time} onChange={(e) => set("start_time", e.target.value)} />
            </L>
            <L label="Heure de fin">
              <input className="field" type="time" value={f.end_time} onChange={(e) => set("end_time", e.target.value)} />
            </L>
          </div>

          <L label="Lieu">
            <input className="field" placeholder="Adresse, salle…" value={f.location} onChange={(e) => set("location", e.target.value)} maxLength={300} />
          </L>

          <div className="grid grid-cols-2 gap-5">
            <L label="Client">
              <input className="field" value={f.client_name} onChange={(e) => set("client_name", e.target.value)} maxLength={160} />
            </L>
            <L label="E-mail du client">
              <input className="field" type="email" value={f.client_email} onChange={(e) => set("client_email", e.target.value)} maxLength={160} />
            </L>
          </div>

          {prestation && (
            <>
              <div>
                <span className="label">À créer quand la date est validée</span>
                <div className="mt-2 border border-line divide-y divide-line">
                  <Check checked={f.want_photo} onChange={(v) => set("want_photo", v)} icon={<ImageIcon className="w-4 h-4" />} label="Galerie photo" done={Boolean(event?.gallery_id)} />
                  <Check checked={f.want_video} onChange={(v) => set("want_video", v)} icon={<FilmIcon className="w-4 h-4" />} label="Projet vidéo" done={Boolean(event?.video_id)} />
                  <Check
                    checked={f.want_board}
                    onChange={(v) => set("want_board", v)}
                    icon={<BoardIcon className="w-4 h-4" />}
                    label="Tableau de préparation"
                    hint="Copie de votre modèle des nouveaux tableaux"
                    done={Boolean(event?.board_id)}
                  />
                </div>
              </div>
              <L label="Prix convenu (€)">
                <input className="field" inputMode="decimal" placeholder="Ex. 1200" value={f.price} onChange={(e) => set("price", e.target.value)} />
              </L>
            </>
          )}

          <L label="Notes">
            <textarea className="field leading-relaxed" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={4000} />
          </L>

          {/* Ce qui a été créé à la confirmation. */}
          {event && (event.gallery_id || event.video_id || event.board_id || event.quote_id) && (
            <div className="border border-line divide-y divide-line">
              {event.gallery_id && <Linked href={`/admin/galleries/${event.gallery_id}`} icon={<ImageIcon className="w-4 h-4" />} label="Galerie photo" />}
              {event.video_id && <Linked href={`/admin/galleries/${event.video_id}`} icon={<FilmIcon className="w-4 h-4" />} label="Projet vidéo" />}
              {event.board_id && <Linked href={`/admin/boards/${event.board_id}`} icon={<BoardIcon className="w-4 h-4" />} label="Tableau de préparation" />}
              {event.quote_id && <Linked href={`/admin/finances/devis/${event.quote_id}`} icon={<MoneyIcon className="w-4 h-4" />} label={`Devis${event.price_cents ? ` · ${formatCents(event.price_cents)}` : ""}`} />}
            </div>
          )}

          {notice?.ok && <p className="text-sm text-accent">{notice.ok}</p>}
          {notice?.error && <p className="text-sm text-danger">{notice.error}</p>}

          <div className="space-y-3">
            {prestation && !confirmed && (
              <button className="btn w-full" disabled={busy} onClick={() => save(true)}>
                {busy ? "…" : "Date validée : confirmer et créer les projets"}
              </button>
            )}
            <button className={`btn w-full ${prestation && !confirmed ? "btn-ghost" : ""}`} disabled={busy} onClick={() => save(false)}>
              {busy ? "…" : prestation && !event ? "Enregistrer en option" : "Enregistrer"}
            </button>
            {prestation && id && !event?.quote_id && (
              <button className="btn btn-ghost w-full" disabled={busy || !f.price.trim()} onClick={quote} title={f.price.trim() ? "" : "Indiquez d'abord le prix convenu"}>
                Préparer le devis à envoyer au client
              </button>
            )}
            {prestation && !confirmed && !event?.quote_id && (
              <p className="text-xs text-muted leading-relaxed">
                Si le client accepte le devis en ligne, la date est confirmée toute seule et les projets sont créés.
              </p>
            )}
          </div>

          {event && (
            <div className="flex flex-wrap gap-x-5 gap-y-2 pt-4 border-t border-line text-xs">
              {prestation && status !== "option" && (
                <button className="text-muted hover:text-ink" disabled={busy} onClick={() => run(() => setEventStatus(event.id, "option"))}>Remettre en option</button>
              )}
              {status !== "cancelled" && (
                <button className="text-muted hover:text-ink" disabled={busy} onClick={() => run(() => setEventStatus(event.id, "cancelled"))}>Annulé par le client</button>
              )}
              {status === "cancelled" && prestation && (
                <button className="text-muted hover:text-ink" disabled={busy} onClick={() => run(() => confirmEventAction(event.id))}>Rétablir et confirmer</button>
              )}
              <button
                className="text-danger ml-auto"
                disabled={busy}
                onClick={() => {
                  if (confirm("Retirer cet événement du calendrier ? Les galeries, vidéos, tableaux et devis déjà créés restent.")) run(() => deleteEvent(event.id), true);
                }}
              >
                Supprimer
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

/** Case à cocher d'un projet à créer ; `done` = déjà créé (case figée). */
function Check({ checked, onChange, icon, label, hint, done }: { checked: boolean; onChange: (v: boolean) => void; icon: React.ReactNode; label: string; hint?: string; done?: boolean }) {
  return (
    <label className={`flex items-center gap-3 px-4 py-3 ${done ? "cursor-default" : "cursor-pointer hover:bg-bg-soft"}`}>
      <input type="checkbox" className="w-4 h-4 accent-current shrink-0" checked={checked || Boolean(done)} disabled={done} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-muted">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-[11px] text-muted">{hint}</span>}
      </span>
      {done && <span className="text-[11px] text-accent shrink-0">Créé ✓</span>}
    </label>
  );
}

function Linked({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <HoverLink href={href} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-bg-soft">
      <span className="text-muted">{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="text-muted">→</span>
    </HoverLink>
  );
}
