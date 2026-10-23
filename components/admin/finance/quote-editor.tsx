"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  FRANCHISE_MENTION,
  METHOD_LABEL,
  cleanLink,
  STATUS_LABEL,
  depositCents,
  formatCents,
  formatDay,
  parseEuros,
  quoteBadge,
  quoteState,
  quoteTotals,
  todayParis,
  UNITS,
  type CatalogItem,
  type FinanceSettings,
  type Payment,
  type PaymentMethod,
  type Quote,
  type QuoteStatus,
} from "@/lib/finance";
import {
  addPayment,
  deletePayment,
  deleteQuote,
  duplicateQuote,
  emailQuote,
  saveQuote,
  setQuoteStatus,
} from "@/app/admin/finance-actions";
import { Toggle } from "@/components/admin/ui";
import { HoverLink } from "@/components/admin/hover-link";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { QuoteBadge } from "./finance-parts";

/** Ligne en cours de saisie : `unit` = prix unitaire tapé, `uom` = unité (Heure, Forfait…). */
type Line = { label: string; desc: string; uom: string; qty: string; unit: string };

const EMPTY: Line = { label: "", desc: "", uom: "", qty: "1", unit: "" };
const toLine = (l: Quote["lines"][number]): Line => ({
  label: l.label,
  desc: l.description ?? "",
  uom: l.unit ?? "",
  qty: String(l.qty).replace(".", ","),
  unit: l.unit_cents ? (l.unit_cents / 100).toFixed(2).replace(".", ",") : "",
});
const fromLine = (l: Line) => ({
  label: l.label,
  description: l.desc,
  unit: l.uom,
  qty: Number(l.qty.replace(",", ".")) || 0,
  unit_cents: parseEuros(l.unit) ?? 0,
});
const fromCatalog = (c: CatalogItem): Line => ({
  label: c.name,
  desc: c.description,
  uom: c.unit,
  qty: "1",
  unit: c.price_cents ? (c.price_cents / 100).toFixed(2).replace(".", ",") : "",
});

export function QuoteEditor({
  quote,
  payments,
  settings,
  projects,
  catalog,
  mailer,
}: {
  catalog: CatalogItem[];
  quote: Quote;
  payments: Payment[];
  settings: FinanceSettings;
  projects: { id: string; title: string; kind: "photo" | "video" }[];
  mailer: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: quote.title,
    client_name: quote.client_name,
    client_email: quote.client_email ?? "",
    client_address: quote.client_address,
    gallery_id: quote.gallery_id ?? "",
    vat_rate: String(quote.vat_rate).replace(".", ","),
    deposit_pct: String(quote.deposit_pct),
    issued_on: quote.issued_on,
    valid_until: quote.valid_until ?? "",
    due_on: quote.due_on ?? "",
    lock_gallery: quote.lock_gallery,
    invoice_ref: quote.invoice_ref,
    notes: quote.notes,
    payment_link: quote.payment_link,
  });
  const [lines, setLines] = useState<Line[]>(() => (quote.lines.length ? quote.lines.map(toLine) : [EMPTY]));
  const [picker, setPicker] = useState(false);
  const addFromCatalog = (c: CatalogItem) => {
    // Une seule ligne encore vide : l'article la remplace.
    setLines((ls) => [...ls.filter((l) => l.label.trim() || l.unit.trim()), fromCatalog(c)]);
    setDirty(true);
    setPicker(false);
  };
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<{ ok?: string; error?: string } | null>(null);
  const [saving, startSave] = useTransition();

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };
  const setLine = (i: number, patch: Partial<Line>) => {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
    setDirty(true);
  };

  const vatRate = Number(form.vat_rate.replace(",", ".")) || 0;
  const totals = useMemo(() => quoteTotals(lines.map(fromLine), vatRate), [lines, vatRate]);
  const paid = payments.reduce((s, p) => s + p.amount_cents, 0);
  const live = { ...quote, total_cents: totals.ttc, deposit_pct: Number(form.deposit_pct) || 0, due_on: form.due_on || null, valid_until: form.valid_until || null };
  const state = quoteState(live, paid);
  const deposit = depositCents(live);
  const franchise = settings.vat_mode !== "vat";
  const linked = projects.find((p) => p.id === form.gallery_id);

  async function save() {
    const r = await saveQuote(quote.id, {
      ...form,
      gallery_id: form.gallery_id || null,
      lines: lines.map(fromLine),
      vat_rate: vatRate,
      deposit_pct: Number(form.deposit_pct) || 0,
      valid_until: form.valid_until || null,
      due_on: form.due_on || null,
    });
    if (!r.error) setDirty(false);
    return r;
  }

  function onSave() {
    startSave(async () => {
      const r = await save();
      setNotice(r.error ? { error: r.error } : { ok: "Enregistré ✓" });
      router.refresh();
    });
  }

  function onStatus(status: QuoteStatus) {
    startSave(async () => {
      if (dirty) {
        const r = await save();
        if (r.error) return setNotice({ error: r.error });
      }
      const r = await setQuoteStatus(quote.id, status);
      setNotice(r.error ? { error: r.error } : null);
      router.refresh();
    });
  }

  return (
    <div className="pb-28">
      <div className="flex flex-wrap items-center gap-3 mb-10">
        <HoverLink href="/admin/finances/devis" className="eyebrow text-muted hover:text-ink">← Devis</HoverLink>
        <span className="display text-2xl ml-2">{quote.number}</span>
        <QuoteBadge {...quoteBadge(live, paid)} />
        <div className="ml-auto flex flex-wrap gap-2">
          <a href={`/d/${quote.share_slug}`} target="_blank" className="btn btn-ghost">Voir / PDF</a>
          <button className="btn btn-ghost" onClick={() => startSave(() => duplicateQuote(quote.id))}>Dupliquer</button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (confirm(`Supprimer le devis ${quote.number} et ses paiements notés ?`)) startSave(() => deleteQuote(quote.id));
            }}
          >
            Supprimer
          </button>
        </div>
      </div>

      <Section title="État">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_LABEL) as QuoteStatus[]).map((s) => (
            <button
              key={s}
              disabled={saving}
              onClick={() => onStatus(s)}
              className={`px-4 py-2 text-xs border ${quote.status === s ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        {quote.accepted_at && quote.status === "accepted" && (
          <p className="text-xs text-muted mt-3">
            Accepté le {formatDay(quote.accepted_at.slice(0, 10))}
            {quote.accepted_name ? ` en ligne par ${quote.accepted_name}` : ""}.
          </p>
        )}
      </Section>

      <Section title="Client">
        <div className="grid sm:grid-cols-2 gap-6">
          <Field label="Nom (ou société)">
            <input className="field" value={form.client_name} onChange={(e) => set("client_name", e.target.value)} maxLength={160} />
          </Field>
          <Field label="E-mail">
            <input className="field" type="email" value={form.client_email} onChange={(e) => set("client_email", e.target.value)} maxLength={160} />
          </Field>
        </div>
        <Field label="Adresse (facultatif)">
          <textarea className="field" rows={2} value={form.client_address} onChange={(e) => set("client_address", e.target.value)} maxLength={400} />
        </Field>
      </Section>

      <Section title="Prestation">
        <div className="grid sm:grid-cols-2 gap-6">
          <Field label="Titre">
            <input className="field" placeholder="Mariage de Léa & Tom, clip…" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={200} />
          </Field>
          <Field label="Galerie ou projet vidéo lié">
            <select className="field" value={form.gallery_id} onChange={(e) => set("gallery_id", e.target.value)}>
              <option value="">Aucun</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.kind === "video" ? "🎬 " : ""}{p.title}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-8">
          <div className="hidden sm:grid grid-cols-[1fr_5rem_7rem_7rem_2rem] gap-3 text-xs text-muted pb-2 border-b border-line">
            <span>Description</span>
            <span className="text-right">Quantité</span>
            <span className="text-right">Prix unitaire {franchise ? "" : "HT"}</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          {lines.map((l, i) => {
            const t = fromLine(l);
            return (
              <div key={i} className="grid grid-cols-[1fr_4.5rem_6.5rem_2rem] sm:grid-cols-[1fr_5rem_7rem_7rem_2rem] gap-3 items-center py-3 border-b border-line">
                <span className="col-span-4 sm:col-span-1 min-w-0">
                  <input className="field" placeholder="Ex. Reportage photo (8 h)" value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} maxLength={300} />
                  <textarea
                    className="block w-full mt-1 bg-transparent text-xs text-muted leading-relaxed outline-none resize-none placeholder:text-muted/60"
                    rows={l.desc ? Math.min(4, Math.ceil(l.desc.length / 70)) : 1}
                    placeholder="Description (facultatif)"
                    value={l.desc}
                    onChange={(e) => setLine(i, { desc: e.target.value })}
                    maxLength={1000}
                  />
                </span>
                <span className="min-w-0">
                  <input className="field text-right" inputMode="decimal" aria-label="Quantité" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
                  <select
                    aria-label="Unité"
                    className="block w-full mt-1 bg-transparent text-[11px] text-muted text-right outline-none"
                    value={l.uom}
                    onChange={(e) => setLine(i, { uom: e.target.value })}
                  >
                    <option value="">—</option>
                    {[...new Set([...UNITS, ...(l.uom ? [l.uom] : [])])].map((u) => (
                      <option key={u} value={u}>{u.toLowerCase()}</option>
                    ))}
                  </select>
                </span>
                <input className="field text-right" inputMode="decimal" aria-label="Prix unitaire" placeholder="0,00" value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} />
                <span className="hidden sm:block text-right text-sm tabular-nums">{formatCents(Math.round(t.qty * t.unit_cents))}</span>
                <button
                  className="icon-btn"
                  aria-label="Retirer la ligne"
                  onClick={() => {
                    setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [EMPTY]));
                    setDirty(true);
                  }}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            {catalog.length > 0 && (
              <button className="flex items-center gap-2 text-sm hover:opacity-70" onClick={() => setPicker((v) => !v)}>
                <PlusIcon className="w-4 h-4" /> Ajouter un article
              </button>
            )}
            <button
              className="flex items-center gap-2 text-sm text-muted hover:text-ink"
              onClick={() => {
                setLines((ls) => [...ls, EMPTY]);
                setDirty(true);
              }}
            >
              <PlusIcon className="w-4 h-4" /> Ligne libre
            </button>
          </div>
          {picker && <CatalogPicker items={catalog} onPick={addFromCatalog} onClose={() => setPicker(false)} />}
        </div>

        <div className="mt-8 grid sm:grid-cols-2 gap-8 items-start">
          <div className="grid grid-cols-2 gap-6">
            {!franchise && (
              <Field label="TVA (%)">
                <input className="field" inputMode="decimal" value={form.vat_rate} onChange={(e) => set("vat_rate", e.target.value)} />
              </Field>
            )}
            <Field label="Acompte demandé (%)">
              <input className="field" inputMode="numeric" value={form.deposit_pct} onChange={(e) => set("deposit_pct", e.target.value.replace(/\D/g, "").slice(0, 3))} />
            </Field>
          </div>
          <dl className="text-sm space-y-2">
            {!franchise && (
              <>
                <Row label="Total HT" value={formatCents(totals.ht)} />
                <Row label={`TVA ${form.vat_rate} %`} value={formatCents(totals.vat)} />
              </>
            )}
            <Row label={franchise ? "Total" : "Total TTC"} value={formatCents(totals.ttc)} strong />
            {franchise && <p className="text-xs text-muted text-right">{FRANCHISE_MENTION}</p>}
            {deposit > 0 && <Row label={`Acompte (${form.deposit_pct} %)`} value={formatCents(deposit)} />}
          </dl>
        </div>
      </Section>

      <Section title="Dates">
        <div className="grid sm:grid-cols-3 gap-6">
          <Field label="Date du devis">
            <input className="field" type="date" value={form.issued_on} onChange={(e) => set("issued_on", e.target.value)} />
          </Field>
          <Field label="Valable jusqu'au">
            <input className="field" type="date" value={form.valid_until} onChange={(e) => set("valid_until", e.target.value)} />
          </Field>
          <Field label="Solde à payer avant le">
            <input className="field" type="date" value={form.due_on} onChange={(e) => set("due_on", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Galerie bloquée tant que ce n'est pas payé">
        <div className={linked ? "" : "opacity-40 pointer-events-none"}>
          <Toggle
            checked={form.lock_gallery}
            onChange={(v) => set("lock_gallery", v)}
            label={linked ? `Bloquer les téléchargements de « ${linked.title} »` : "Reliez d'abord une galerie ou un projet vidéo"}
            hint="Le client voit ses photos et vidéos, mais ne peut rien télécharger tant que le devis (envoyé ou accepté) n'est pas entièrement réglé. Le blocage se lève tout seul au dernier paiement noté."
          />
        </div>
      </Section>

      <Section title="Message et conditions sur le devis">
        <textarea
          className="field leading-relaxed"
          rows={4}
          placeholder={settings.terms || "Ex. Livraison des photos sous 4 semaines. Déplacement inclus dans un rayon de 50 km."}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          maxLength={4000}
        />
        <p className="text-xs text-muted mt-2">Vide = vos conditions habituelles (Finances → Réglages).</p>
        <div className="mt-6">
          <Field label="N° de la facture (faite dans votre logiciel de facturation)">
            <input className="field" placeholder="Ex. F-2026-014" value={form.invoice_ref} onChange={(e) => set("invoice_ref", e.target.value)} maxLength={200} />
          </Field>
        </div>
      </Section>

      <Payments quote={quote} quoteId={quote.id} payments={payments} state={state} deposit={deposit} total={totals.ttc} dirty={dirty}>
        <Field label="Lien de paiement en ligne pour ce devis (facultatif)">
          <input
            className="field"
            inputMode="url"
            placeholder={settings.payment_link || "https://revolut.me/votre-nom"}
            value={form.payment_link}
            onChange={(e) => set("payment_link", e.target.value)}
            maxLength={500}
          />
        </Field>
        <p className="text-xs text-muted mt-2">
          {settings.payment_link ? "Vide = votre lien habituel (Réglages). " : ""}Le client voit un bouton « Payer » sur la page du devis. Avec Revolut Business, vous
          pouvez coller ici un lien créé pour le montant exact.
        </p>
      </Payments>

      <Mail quote={quote} mailer={mailer} settings={settings} state={state} deposit={deposit} total={totals.ttc} form={form} save={save} dirty={dirty} />

      {/* Barre d'enregistrement, toujours visible. */}
      <div className="fixed inset-x-0 bottom-[calc(var(--tabbar,0px)+env(safe-area-inset-bottom))] lg:bottom-0 lg:left-64 z-30 border-t border-line bg-bg/95 backdrop-blur-md">
        <div className="max-w-5xl px-5 sm:px-8 lg:px-12 h-16 flex items-center gap-4">
          <span className={`text-sm ${notice?.error ? "text-danger" : "text-muted"}`}>
            {notice?.error ?? (dirty ? "Modifications non enregistrées" : notice?.ok ?? `Total ${formatCents(totals.ttc)}`)}
          </span>
          <button className="btn ml-auto" onClick={onSave} disabled={saving || !dirty}>
            {saving ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Payments({
  quoteId,
  payments,
  state,
  deposit,
  total,
  dirty,
  children,
  quote,
}: {
  children: React.ReactNode;
  quote: Quote;
  quoteId: string;
  payments: Payment[];
  state: ReturnType<typeof quoteState>;
  deposit: number;
  total: number;
  dirty: boolean;
}) {
  const router = useRouter();
  const suggestion = state.paid === 0 && deposit > 0 ? deposit : state.remaining;
  const [amount, setAmount] = useState(suggestion ? (suggestion / 100).toFixed(2).replace(".", ",") : "");
  const [date, setDate] = useState(todayParis());
  const [method, setMethod] = useState<PaymentMethod>("virement");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function add() {
    const cents = parseEuros(amount);
    if (!cents || cents <= 0) return setError("Montant invalide.");
    start(async () => {
      const r = await addPayment(quoteId, { amount_cents: cents, paid_on: date, method, note });
      if (r.error) return setError(r.error);
      setError(null);
      setNote("");
      router.refresh();
    });
  }

  return (
    <Section title="Paiements reçus">
      <div className="h-1.5 bg-bg-soft rounded-full overflow-hidden">
        <div className="h-full bg-accent transition-all duration-700" style={{ width: `${total ? Math.min(100, (state.paid / total) * 100) : 0}%` }} />
      </div>
      <p className="text-sm mt-3">
        <b className="font-medium">{formatCents(state.paid)}</b> reçus sur {formatCents(total)}
        {state.remaining > 0 ? <span className="text-muted"> · reste {formatCents(state.remaining)}</span> : total > 0 ? <span className="text-accent"> · tout est réglé</span> : null}
      </p>
      {payClickedSincePayment(quote, payments, state.remaining) && (
        <p className="text-sm text-warn mt-3">
          Le client a cliqué sur « Payer » le {formatDay(quote.pay_clicked_at!.slice(0, 10))}. Vérifiez votre compte (Revolut…), puis notez le paiement ci-dessous.
        </p>
      )}
      {dirty && <p className="text-xs text-warn mt-2">Enregistrez d&apos;abord le devis pour que le total soit à jour.</p>}
      <div className="mt-8">{children}</div>

      {payments.length > 0 && (
        <ul className="mt-6">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center gap-4 py-3 border-b border-line text-sm">
              <span className="text-muted w-24 shrink-0">{formatDay(p.paid_on)}</span>
              <span className="flex-1 min-w-0 truncate">{METHOD_LABEL[p.method]}{p.note ? ` · ${p.note}` : ""}</span>
              <span className="tabular-nums">{formatCents(p.amount_cents)}</span>
              <button
                className="icon-btn"
                aria-label="Supprimer ce paiement"
                onClick={() => {
                  if (confirm("Supprimer ce paiement ?")) start(async () => { await deletePayment(quoteId, p.id); router.refresh(); });
                }}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-[8rem_10rem_9rem_1fr_auto] gap-3 items-end">
        <Field label="Montant (€)">
          <input className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Reçu le">
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Moyen">
          <select className="field" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>{METHOD_LABEL[m]}</option>
            ))}
          </select>
        </Field>
        <Field label="Note (facultatif)">
          <input className="field" placeholder="Acompte, solde…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </Field>
        <button className="btn col-span-2 sm:col-span-1" onClick={add} disabled={busy}>{busy ? "…" : "Noter le paiement"}</button>
      </div>
      {error && <p className="text-sm text-danger mt-3">{error}</p>}
    </Section>
  );
}

function Mail({
  quote,
  mailer,
  settings,
  state,
  deposit,
  total,
  form,
  save,
  dirty,
}: {
  quote: Quote;
  mailer: boolean;
  settings: FinanceSettings;
  state: ReturnType<typeof quoteState>;
  deposit: number;
  total: number;
  form: { title: string; client_name: string; client_email: string; due_on: string; payment_link: string };
  save: () => Promise<{ error?: string }>;
  dirty: boolean;
}) {
  const router = useRouter();
  const reminder = quote.status !== "draft" && state.remaining > 0 && (quote.status === "accepted" || state.paid > 0 || Boolean(quote.sent_at));
  const [kind, setKind] = useState<"send" | "reminder">(reminder ? "reminder" : "send");
  const hello = form.client_name ? `Bonjour ${form.client_name.split(/\s+/)[0]},` : "Bonjour,";
  const what = form.title || "votre projet";
  // Le paiement en ligne est sur la page du devis (bouton « Payer ») : pas de lien de paiement dans l'e-mail.
  const online = Boolean(cleanLink(form.payment_link) || settings.payment_link);
  const templates = {
    send: {
      subject: `Devis ${quote.number}${form.title ? ` — ${form.title}` : ""}`,
      body: `${hello}

Voici mon devis pour ${what}, d'un montant de ${formatCents(total)}.

${deposit > 0 ? `Un acompte de ${formatCents(deposit)} est demandé pour réserver la date${online ? ", à régler directement depuis la page du devis" : ""}.\n\n` : ""}Vous pouvez le consulter, l'enregistrer en PDF et l'accepter en ligne :
{lien}

Je reste disponible pour toute question.

À très vite,`,
    },
    reminder: {
      subject: `Rappel — ${form.title || `devis ${quote.number}`}`,
      body: `${hello}

Petit rappel concernant ${what} : il reste ${formatCents(state.remaining)} à régler${form.due_on ? ` (échéance du ${formatDay(form.due_on)})` : ""}.

${online ? "Vous pouvez régler en ligne depuis la page du devis :" : "Le détail est ici :"}
{lien}

Si le paiement est déjà parti, merci de ne pas tenir compte de ce message.

Belle journée,`,
    },
  };
  const [subject, setSubject] = useState(templates[kind].subject);
  const [body, setBody] = useState(templates[kind].body);
  const [notice, setNotice] = useState<{ ok?: string; error?: string } | null>(null);
  const [busy, start] = useTransition();

  function pick(k: "send" | "reminder") {
    setKind(k);
    setSubject(templates[k].subject);
    setBody(templates[k].body);
    setNotice(null);
  }

  function send() {
    if (!form.client_email) return setNotice({ error: "Ajoutez l'adresse e-mail du client (section Client)." });
    if (!confirm(`Envoyer cet e-mail à ${form.client_email} ?`)) return;
    start(async () => {
      if (dirty) {
        const r = await save();
        if (r.error) return setNotice({ error: r.error });
      }
      const r = await emailQuote(quote.id, { subject, body, kind });
      setNotice(r);
      router.refresh();
    });
  }

  return (
    <Section title="Envoyer au client">
      {!mailer && (
        <p className="text-sm border border-line bg-bg-soft px-4 py-3 mb-6 leading-relaxed">
          L&apos;envoi Gmail n&apos;est pas branché (SMTP_USER / SMTP_PASS sur Netlify). Vous pouvez quand même copier le lien du devis :
          bouton « Voir / PDF ».
        </p>
      )}
      <div className="flex gap-2 mb-6">
        <button onClick={() => pick("send")} className={`px-4 py-2 text-xs border ${kind === "send" ? "border-ink" : "border-line text-muted hover:text-ink"}`}>Envoyer le devis</button>
        <button onClick={() => pick("reminder")} className={`px-4 py-2 text-xs border ${kind === "reminder" ? "border-ink" : "border-line text-muted hover:text-ink"}`}>Relance de paiement</button>
      </div>
      <div className="space-y-6">
        <Field label="Objet">
          <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
        </Field>
        <Field label="Message">
          <textarea className="field leading-relaxed" rows={11} style={{ minHeight: "16rem", resize: "vertical" }} value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} />
        </Field>
        <p className="text-xs text-muted -mt-3">« {"{lien}"} » seul sur sa ligne devient le bouton « Voir le devis ». Votre signature (logo et réseaux) est ajoutée en bas.</p>
        <div className="flex flex-wrap items-center gap-4">
          <button className="btn" onClick={send} disabled={!mailer || busy}>{busy ? "Envoi…" : kind === "send" ? "Envoyer le devis" : "Envoyer la relance"}</button>
          {quote.sent_at && <span className="text-xs text-muted">Devis envoyé le {formatDay(quote.sent_at.slice(0, 10))}</span>}
          {quote.last_reminder_at && <span className="text-xs text-muted">Dernière relance le {formatDay(quote.last_reminder_at.slice(0, 10))}</span>}
        </div>
        {notice?.ok && <p className="text-sm text-accent">{notice.ok}</p>}
        {notice?.error && <p className="text-sm text-danger">{notice.error}</p>}
      </div>
    </Section>
  );
}

/** Clic sur « Payer » plus récent que le dernier paiement noté, et il reste à payer. */
function payClickedSincePayment(quote: Quote, payments: Payment[], remaining: number) {
  if (!quote.pay_clicked_at || remaining <= 0) return false;
  return payments.every((p) => (p.created_at ?? "") < quote.pay_clicked_at!);
}

/** Liste des articles du catalogue, avec recherche ; un clic ajoute la ligne au devis. */
function CatalogPicker({ items, onPick, onClose }: { items: CatalogItem[]; onPick: (c: CatalogItem) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const shown = items.filter((c) => `${c.name} ${c.reference} ${c.description}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="mt-3 border border-line bg-bg shadow-xl animate-[fadeUp_0.2s_ease-out_both]">
      <div className="flex items-center gap-2 px-4 border-b border-line">
        <input className="field" style={{ borderBottom: 0 }} autoFocus placeholder="Rechercher un article…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && onClose()} />
        <button className="text-xs text-muted hover:text-ink shrink-0" onClick={onClose}>Fermer</button>
      </div>
      <ul className="max-h-80 overflow-y-auto">
        {shown.map((c) => (
          <li key={c.id}>
            <button className="w-full flex items-start gap-4 px-4 py-3 text-left hover:bg-bg-soft" onClick={() => onPick(c)}>
              <span className="flex-1 min-w-0">
                <span className="block text-sm">{c.name}</span>
                {c.description && <span className="block text-xs text-muted truncate">{c.description}</span>}
              </span>
              <span className="text-sm tabular-nums shrink-0">{formatCents(c.price_cents)}<span className="text-[11px] text-muted"> / {c.unit.toLowerCase()}</span></span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-4 py-6 text-sm text-muted text-center">Aucun article.</li>}
      </ul>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-10 border-t border-line first:border-t-0 first:pt-0">
      <h2 className="eyebrow text-muted mb-6">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "text-base font-medium pt-2 border-t border-line" : "text-muted"}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums text-ink">{value}</dd>
    </div>
  );
}
