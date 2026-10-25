/** Finances du studio : types et calculs partagés (studio, page publique d'un devis). Montants en centimes. */

/** Ligne de devis ; `description` et `unit` (Heure, Forfait…) viennent en général d'un article du catalogue. */
export type QuoteLine = { label: string; description?: string; unit?: string; qty: number; unit_cents: number };

/** Article du catalogue (Finances → Articles), repris dans les devis en un clic. */
export type CatalogItem = {
  id: string;
  name: string;
  reference: string;
  description: string;
  unit: string;
  price_cents: number;
  kind: "service" | "debours";
  position: number;
  archived: boolean;
};
export const CATALOG_FIELDS = "id, name, reference, description, unit, price_cents, kind, position, archived";
export const UNITS = ["Forfait", "Heure", "Jour", "Unité", "Photo", "Vidéo", "Km"];

/** « 2 » + « Heure » → « 2 h » ; « 1 » + « Forfait » → « 1 forfait ». */
export function qtyWithUnit(qty: number, unit?: string) {
  const n = String(qty).replace(".", ",");
  if (!unit) return n;
  const short: Record<string, string> = { Heure: "h", Jour: "j", Km: "km" };
  return `${n} ${short[unit] ?? unit.toLowerCase()}`;
}
export type DiscountType = "none" | "percent" | "amount";
/** Remise sur le total HT : `value` = pourcentage, ou euros (pas des centimes). */
export type Discount = { type: DiscountType; value: number; label?: string };
export type QuoteStatus = "draft" | "sent" | "accepted" | "refused" | "cancelled";
export type PaymentMethod = "virement" | "especes" | "carte" | "cheque" | "autre";

export type Quote = {
  id: string;
  number: string;
  title: string;
  client_name: string;
  client_email: string | null;
  /** Téléphone (envoi du devis par WhatsApp / SMS). */
  client_phone: string;
  client_address: string;
  gallery_id: string | null;
  lines: QuoteLine[];
  vat_rate: number;
  total_cents: number;
  deposit_pct: number;
  status: QuoteStatus;
  issued_on: string;
  valid_until: string | null;
  due_on: string | null;
  lock_gallery: boolean;
  invoice_ref: string;
  notes: string;
  /** Lien de paiement de ce devis (vide = celui des réglages). */
  payment_link: string;
  discount_type: DiscountType;
  discount_value: number;
  discount_label: string;
  share_slug: string;
  sent_at: string | null;
  accepted_at: string | null;
  accepted_name: string | null;
  last_reminder_at: string | null;
  /** Dernier clic du client sur « Payer » (page du devis). */
  pay_clicked_at: string | null;
  created_at: string;
};

export type Payment = { id: string; quote_id: string; amount_cents: number; paid_on: string; method: PaymentMethod; note: string; created_at?: string };
export type Expense = { id: string; label: string; category: string; amount_cents: number; spent_on: string; note: string };

/** Infos légales et habitudes de facturation (Finances → Réglages), gardées dans studio_settings.finance. */
export type FinanceSettings = {
  business_name?: string;
  owner_name?: string;
  address?: string;
  siret?: string;
  email?: string;
  phone?: string;
  /** franchise = micro-entreprise sans TVA (mention art. 293 B) ; vat = TVA facturée. */
  vat_mode?: "franchise" | "vat";
  vat_rate?: number;
  iban?: string;
  bic?: string;
  /** Lien de paiement en ligne (Revolut, PayPal, Lydia, Stripe…), bouton « Payer » sur la page du devis. */
  payment_link?: string;
  validity_days?: number;
  /** Objectif d'encaissement par mois, en euros (jauge de l'Accueil). */
  monthly_goal?: number;
  deposit_pct?: number;
  terms?: string;
};

export const QUOTE_FIELDS =
  "id, number, title, client_name, client_email, client_phone, client_address, gallery_id, lines, vat_rate, total_cents, deposit_pct, status, issued_on, valid_until, due_on, lock_gallery, invoice_ref, notes, payment_link, discount_type, discount_value, discount_label, share_slug, sent_at, accepted_at, accepted_name, last_reminder_at, pay_clicked_at, created_at";

export const STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  refused: "Refusé",
  cancelled: "Annulé",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  virement: "Virement",
  especes: "Espèces",
  carte: "Carte",
  cheque: "Chèque",
  autre: "Autre",
};

export const EXPENSE_CATEGORIES: Record<string, string> = {
  materiel: "Matériel",
  logiciels: "Logiciels & abonnements",
  deplacements: "Déplacements",
  location: "Location",
  sous_traitance: "Sous-traitance",
  publicite: "Publicité",
  cotisations: "Cotisations & impôts",
  autre: "Autre",
};

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const euroRound = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** 123456 → « 1 234,56 € » ; round = sans centimes (chiffres du tableau de bord). */
export function formatCents(cents: number, round = false) {
  return (round ? euroRound : euro).format(cents / 100);
}

/** « 1 234,5 » ou « 1234.50 » → 123450 centimes (null si illisible). */
export function parseEuros(input: string): number | null {
  const s = input.replace(/\s|€/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{0,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export function lineTotal(l: QuoteLine) {
  return Math.round(l.qty * l.unit_cents);
}

/** Totaux d'un devis : HT (somme des lignes), TVA, TTC. */
export function quoteTotals(lines: QuoteLine[], vatRate: number, discount?: Discount | null) {
  const gross = lines.reduce((s, l) => s + lineTotal(l), 0);
  const value = Math.max(0, Number(discount?.value) || 0);
  const off =
    discount?.type === "percent" ? Math.round((gross * Math.min(100, value)) / 100) : discount?.type === "amount" ? Math.min(gross, Math.round(value * 100)) : 0;
  const ht = gross - off;
  const vat = Math.round((ht * vatRate) / 100);
  return { gross, discount: off, ht, vat, ttc: ht + vat };
}

/** Remise lue d'un devis (colonnes discount_*). */
export const quoteDiscount = (q: Pick<Quote, "discount_type" | "discount_value" | "discount_label">): Discount => ({
  type: q.discount_type ?? "none",
  value: Number(q.discount_value) || 0,
  label: q.discount_label ?? "",
});

/** « Remise 10 % » / « Remise » + libellé éventuel. */
export function discountText(d: Discount) {
  const base = d.label?.trim() || "Remise";
  return d.type === "percent" ? `${base} (${String(d.value).replace(".", ",")} %)` : base;
}

/**
 * Repères des e-mails, remplacés à l'envoi par les vrais chiffres du devis :
 * {montant} total, {acompte} acompte encore dû, {reste} reste à payer, {echeance} date du solde.
 */
export function fillAmounts(text: string, v: { total: number; deposit: number; paid: number; due_on: string | null }) {
  const remaining = Math.max(0, v.total - v.paid);
  return text
    .replaceAll("{montant}", formatCents(v.total))
    .replaceAll("{acompte}", formatCents(Math.max(0, v.deposit - v.paid)))
    .replaceAll("{reste}", formatCents(remaining))
    .replaceAll("{echeance}", v.due_on ? formatDay(v.due_on) : "dès que possible");
}

export function depositCents(q: Pick<Quote, "total_cents" | "deposit_pct">) {
  return Math.round((q.total_cents * q.deposit_pct) / 100);
}

/** Date du jour à Paris, « AAAA-MM-JJ ». */
export function todayParis() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDay(date: string | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

/** Où en est un devis côté argent. */
export function quoteState(q: Pick<Quote, "status" | "total_cents" | "due_on" | "valid_until">, paid: number, today = todayParis()) {
  const remaining = Math.max(0, q.total_cents - paid);
  const counts = q.status === "sent" || q.status === "accepted";
  const settled = counts && q.total_cents > 0 && remaining === 0;
  const overdue = counts && remaining > 0 && q.status === "accepted" && q.due_on !== null && q.due_on < today;
  const expired = q.status === "sent" && q.valid_until !== null && q.valid_until < today;
  return { paid, remaining, settled, overdue, expired };
}

/** Pastille affichée dans les listes : l'état le plus utile en premier. */
export function quoteBadge(q: Quote, paid: number): { label: string; tone: "muted" | "accent" | "warn" | "danger" | "ink" } {
  const s = quoteState(q, paid);
  if (q.status === "draft") return { label: "Brouillon", tone: "muted" };
  if (q.status === "refused" || q.status === "cancelled") return { label: STATUS_LABEL[q.status], tone: "muted" };
  if (s.settled) return { label: "Payé", tone: "accent" };
  if (s.overdue) return { label: "En retard", tone: "danger" };
  if (s.expired) return { label: "Expiré", tone: "warn" };
  if (paid > 0) return { label: "Acompte reçu", tone: "warn" };
  return { label: STATUS_LABEL[q.status], tone: q.status === "accepted" ? "ink" : "muted" };
}

export function cleanSettings(src: Record<string, unknown>): FinanceSettings {
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const int = (v: unknown, min: number, max: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
  };
  const out: FinanceSettings = {
    business_name: text(src.business_name, 120),
    owner_name: text(src.owner_name, 120),
    address: text(src.address, 400),
    siret: text(src.siret, 20).replace(/[^\d ]/g, ""),
    email: text(src.email, 120),
    phone: text(src.phone, 30),
    vat_mode: src.vat_mode === "vat" ? "vat" : "franchise",
    vat_rate: src.vat_mode === "vat" ? Math.min(100, Math.max(0, Number(String(src.vat_rate ?? 20).replace(",", ".")) || 0)) : 0,
    iban: text(src.iban, 40).toUpperCase(),
    bic: text(src.bic, 15).toUpperCase(),
    payment_link: cleanLink(src.payment_link),
    validity_days: int(src.validity_days, 1, 365) ?? 30,
    monthly_goal: int(src.monthly_goal, 0, 1_000_000) || undefined,
    deposit_pct: int(src.deposit_pct, 0, 100) ?? 30,
    terms: text(src.terms, 2000),
  };
  for (const k of Object.keys(out) as (keyof FinanceSettings)[]) if (out[k] === "") delete out[k];
  return out;
}

export function cleanLines(src: unknown): QuoteLine[] {
  if (!Array.isArray(src)) return [];
  return src
    .slice(0, 60)
    .map((l) => {
      const r = (l ?? {}) as Record<string, unknown>;
      const qty = Math.round(Math.min(100000, Math.max(0, Number(r.qty) || 0)) * 100) / 100;
      const unit = Math.round(Math.min(100_000_000, Math.max(0, Number(r.unit_cents) || 0)));
      const line: QuoteLine = { label: String(r.label ?? "").trim().slice(0, 300), qty, unit_cents: unit };
      const description = String(r.description ?? "").trim().slice(0, 1000);
      const u = String(r.unit ?? "").trim().slice(0, 30);
      if (description) line.description = description;
      if (u) line.unit = u;
      return line;
    })
    .filter((l) => l.label || l.unit_cents);
}

/** Lien de paiement accepté seulement en https (« revolut.me/xxx » → « https://revolut.me/xxx »). */
export function cleanLink(v: unknown) {
  const s = typeof v === "string" ? v.trim().slice(0, 500) : "";
  if (!s) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return url.protocol === "https:" && url.hostname.includes(".") ? url.toString() : "";
  } catch {
    return "";
  }
}

/** Ce que le client peut payer maintenant : l'acompte s'il n'est pas réglé, sinon le reste. */
export function amountDueNow(q: Pick<Quote, "total_cents" | "deposit_pct">, paid: number) {
  const deposit = depositCents(q);
  if (deposit > 0 && paid < deposit) return { cents: deposit - paid, label: "Payer l'acompte" };
  return { cents: Math.max(0, q.total_cents - paid), label: "Payer la facture" };
}

/** « 06 11 32 94 06 » → « 33611329406 » (format des liens WhatsApp) ; vide si ce n'est pas un numéro. */
export function phoneDigits(phone: string) {
  const d = phone.replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "");
  const fr = d.replace(/^0(\d{9})$/, "33$1");
  return /^\d{8,15}$/.test(fr) ? fr : "";
}

/** Mention obligatoire en micro-entreprise sans TVA. */
export const FRANCHISE_MENTION = "TVA non applicable, art. 293 B du CGI";
