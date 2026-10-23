"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminApi } from "@/lib/auth";
import type { Contact } from "@/lib/contact";
import {
  EXPENSE_CATEGORIES,
  METHOD_LABEL,
  addDays,
  cleanLines,
  cleanLink,
  cleanSettings,
  quoteTotals,
  todayParis,
  type FinanceSettings,
  type PaymentMethod,
  type QuoteStatus,
} from "@/lib/finance";
import { buildMessage, createMailer } from "@/lib/mailer";
import { newSlug } from "@/lib/tokens";

type Result = { error?: string; ok?: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = (v: unknown) => (typeof v === "string" && DAY.test(v) ? v : null);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const STATUSES: QuoteStatus[] = ["draft", "sent", "accepted", "refused", "cancelled"];

function refresh(id?: string) {
  revalidatePath("/admin/finances", "layout");
  if (id) revalidatePath(`/admin/finances/devis/${id}`);
}

async function loadSettings(supabase: Awaited<ReturnType<typeof requireAdminApi>>["supabase"]) {
  const { data } = await supabase.from("studio_settings").select("finance, contact").eq("id", 1).maybeSingle();
  return { finance: (data?.finance ?? {}) as FinanceSettings, contact: (data?.contact ?? {}) as Contact };
}

/** Numéro suivant de l'année : D-2026-001, D-2026-002… (jamais réutilisé, même après suppression). */
async function nextNumber(supabase: Awaited<ReturnType<typeof requireAdminApi>>["supabase"], year: string) {
  const { data } = await supabase.from("quotes").select("number").like("number", `D-${year}-%`).order("number", { ascending: false }).limit(1);
  const last = Number(String(data?.[0]?.number ?? "").split("-")[2]) || 0;
  return `D-${year}-${String(last + 1).padStart(3, "0")}`;
}

/** Nouveau devis (brouillon) pré-rempli avec les réglages, puis ouverture de sa fiche. */
export async function createQuote(galleryId?: string) {
  const { supabase } = await requireAdminApi();
  const { finance } = await loadSettings(supabase);
  const today = todayParis();
  let title = "";
  let gallery: string | null = null;
  if (galleryId) {
    const { data: g } = await supabase.from("galleries").select("id, title").eq("id", galleryId).maybeSingle();
    if (g) {
      gallery = g.id as string;
      title = g.title as string;
    }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from("quotes")
      .insert({
        number: await nextNumber(supabase, today.slice(0, 4)),
        title,
        gallery_id: gallery,
        vat_rate: finance.vat_mode === "vat" ? (finance.vat_rate ?? 20) : 0,
        deposit_pct: finance.deposit_pct ?? 30,
        issued_on: today,
        valid_until: addDays(today, finance.validity_days ?? 30),
        lines: [{ label: "", qty: 1, unit_cents: 0 }],
        share_slug: newSlug(),
      })
      .select("id")
      .single();
    if (!error) {
      refresh();
      redirect(`/admin/finances/devis/${data.id}`);
    }
    if (error.code !== "23505") throw new Error(error.message); // 23505 = numéro pris entre-temps : on réessaie
  }
  throw new Error("Impossible de numéroter le devis, réessayez.");
}

export type QuoteInput = {
  title: string;
  client_name: string;
  client_email: string;
  client_address: string;
  gallery_id: string | null;
  lines: unknown;
  vat_rate: number;
  deposit_pct: number;
  issued_on: string;
  valid_until: string | null;
  due_on: string | null;
  lock_gallery: boolean;
  invoice_ref: string;
  notes: string;
  payment_link: string;
};

export async function saveQuote(id: string, input: QuoteInput): Promise<Result> {
  const { supabase } = await requireAdminApi();
  const lines = cleanLines(input.lines);
  const vatRate = Math.min(100, Math.max(0, Number(input.vat_rate) || 0));
  const email = text(input.client_email, 160).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "L'adresse e-mail du client n'est pas valide." };
  const { error } = await supabase
    .from("quotes")
    .update({
      title: text(input.title, 200),
      client_name: text(input.client_name, 160),
      client_email: email || null,
      client_address: text(input.client_address, 400),
      gallery_id: typeof input.gallery_id === "string" && input.gallery_id ? input.gallery_id : null,
      lines,
      vat_rate: vatRate,
      total_cents: quoteTotals(lines, vatRate).ttc,
      deposit_pct: Math.min(100, Math.max(0, Math.round(Number(input.deposit_pct) || 0))),
      issued_on: day(input.issued_on) ?? todayParis(),
      valid_until: day(input.valid_until),
      due_on: day(input.due_on),
      lock_gallery: Boolean(input.lock_gallery),
      invoice_ref: text(input.invoice_ref, 200),
      notes: text(input.notes, 4000),
      payment_link: cleanLink(input.payment_link),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  refresh(id);
  return { ok: "Enregistré" };
}

export async function setQuoteStatus(id: string, status: QuoteStatus): Promise<Result> {
  const { supabase } = await requireAdminApi();
  if (!STATUSES.includes(status)) return { error: "État inconnu" };
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "accepted") patch.accepted_at = new Date().toISOString();
  if (status === "draft" || status === "sent") Object.assign(patch, { accepted_at: null, accepted_name: null });
  const { error } = await supabase.from("quotes").update(patch).eq("id", id);
  if (error) return { error: error.message };
  refresh(id);
  return {};
}

export async function deleteQuote(id: string) {
  const { supabase } = await requireAdminApi();
  const { error } = await supabase.from("quotes").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
  redirect("/admin/finances/devis");
}

export async function duplicateQuote(id: string) {
  const { supabase } = await requireAdminApi();
  const { data: q } = await supabase
    .from("quotes")
    .select("title, client_name, client_email, client_address, lines, vat_rate, total_cents, deposit_pct")
    .eq("id", id)
    .single();
  if (!q) throw new Error("Devis introuvable");
  const { finance } = await loadSettings(supabase);
  const today = todayParis();
  const { data, error } = await supabase
    .from("quotes")
    .insert({ ...q, number: await nextNumber(supabase, today.slice(0, 4)), issued_on: today, valid_until: addDays(today, finance.validity_days ?? 30), share_slug: newSlug() })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  refresh();
  redirect(`/admin/finances/devis/${data.id}`);
}

export async function addPayment(quoteId: string, input: { amount_cents: number; paid_on: string; method: string; note: string }): Promise<Result> {
  const { supabase } = await requireAdminApi();
  const amount = Math.round(Number(input.amount_cents));
  if (!(amount > 0)) return { error: "Montant invalide." };
  const method = (input.method in METHOD_LABEL ? input.method : "autre") as PaymentMethod;
  const { error } = await supabase
    .from("quote_payments")
    .insert({ quote_id: quoteId, amount_cents: amount, paid_on: day(input.paid_on) ?? todayParis(), method, note: text(input.note, 300) });
  if (error) return { error: error.message };
  // Un paiement reçu sur un devis encore « envoyé » vaut accord du client.
  await supabase.from("quotes").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", quoteId).eq("status", "sent");
  refresh(quoteId);
  return {};
}

export async function deletePayment(quoteId: string, paymentId: string): Promise<Result> {
  const { supabase } = await requireAdminApi();
  const { error } = await supabase.from("quote_payments").delete().eq("id", paymentId).eq("quote_id", quoteId);
  if (error) return { error: error.message };
  refresh(quoteId);
  return {};
}

export async function addExpense(input: { label: string; category: string; amount_cents: number; spent_on: string; note: string }): Promise<Result> {
  const { supabase } = await requireAdminApi();
  const amount = Math.round(Number(input.amount_cents));
  const label = text(input.label, 200);
  if (!label) return { error: "Indiquez ce que vous avez payé." };
  if (!(amount > 0)) return { error: "Montant invalide." };
  const { error } = await supabase.from("expenses").insert({
    label,
    category: input.category in EXPENSE_CATEGORIES ? input.category : "autre",
    amount_cents: amount,
    spent_on: day(input.spent_on) ?? todayParis(),
    note: text(input.note, 300),
  });
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function deleteExpense(id: string): Promise<Result> {
  const { supabase } = await requireAdminApi();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function saveFinanceSettings(input: Record<string, unknown>): Promise<Result> {
  const { supabase } = await requireAdminApi();
  const { error } = await supabase.from("studio_settings").update({ finance: cleanSettings(input), updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { error: error.message };
  refresh();
  return { ok: "Enregistré" };
}

/** Envoie le devis (ou une relance) au client par Gmail, avec le lien de sa page. */
export async function emailQuote(id: string, input: { subject: string; body: string; kind: "send" | "reminder" }): Promise<Result> {
  const { supabase } = await requireAdminApi();
  const { data: q } = await supabase.from("quotes").select("id, status, client_email, share_slug").eq("id", id).single();
  if (!q) return { error: "Devis introuvable" };
  if (!q.client_email) return { error: "Ajoutez l'adresse e-mail du client dans le devis." };
  const subject = text(input.subject, 200);
  const body = text(input.body, 10000);
  if (!subject || !body) return { error: "Objet et message obligatoires." };

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const link = `${origin}/d/${q.share_slug}`;
  const { contact, finance } = await loadSettings(supabase);
  try {
    const { transport, from } = createMailer();
    const { text: plain, html } = buildMessage({ body: body.replaceAll("{lien}", link), contact });
    await transport.sendMail({
      from: { name: finance.business_name || contact.name?.split(/\s+[—-]\s+/)[0] || "ALVZ.REC", address: from },
      to: q.client_email,
      replyTo: finance.email || contact.email || undefined,
      subject,
      text: plain,
      html,
    });
    transport.close();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Échec de l'envoi" };
  }
  const now = new Date().toISOString();
  const patch: Record<string, unknown> =
    input.kind === "reminder" ? { last_reminder_at: now } : { sent_at: now, ...(q.status === "draft" ? { status: "sent" } : {}) };
  await supabase.from("quotes").update(patch).eq("id", id);
  refresh(id);
  return { ok: input.kind === "reminder" ? "Relance envoyée." : "Devis envoyé." };
}
