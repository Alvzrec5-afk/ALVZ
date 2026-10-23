import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { QUOTE_FIELDS, type Expense, type FinanceSettings, type Payment, type Quote } from "@/lib/finance";

export async function loadFinanceSettings(supabase: SupabaseClient) {
  const { data } = await supabase.from("studio_settings").select("finance").eq("id", 1).maybeSingle();
  return (data?.finance ?? {}) as FinanceSettings;
}

/** Tous les devis (hors supprimés) et le total déjà payé de chacun. */
export async function loadQuotes(supabase: SupabaseClient) {
  const [{ data: quotes, error }, { data: payments }] = await Promise.all([
    supabase.from("quotes").select(QUOTE_FIELDS).is("deleted_at", null).order("issued_on", { ascending: false }).order("number", { ascending: false }),
    supabase.from("quote_payments").select("id, quote_id, amount_cents, paid_on, method, note, created_at").order("paid_on", { ascending: false }),
  ]);
  if (error) throw new Error(error.message);
  const list = ((quotes ?? []) as Quote[]).map((q) => ({ ...q, total_cents: Number(q.total_cents), vat_rate: Number(q.vat_rate) }));
  const alive = new Set(list.map((q) => q.id));
  const pays = ((payments ?? []) as Payment[]).map((p) => ({ ...p, amount_cents: Number(p.amount_cents) })).filter((p) => alive.has(p.quote_id));
  const paid = new Map<string, number>();
  for (const p of pays) paid.set(p.quote_id, (paid.get(p.quote_id) ?? 0) + p.amount_cents);
  return { quotes: list, payments: pays, paid };
}

export async function loadExpenses(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("expenses").select("id, label, category, amount_cents, spent_on, note").order("spent_on", { ascending: false }).limit(2000);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Expense[]).map((e) => ({ ...e, amount_cents: Number(e.amount_cents) }));
}

/** Galeries et projets vidéo qu'on peut relier à un devis. */
export async function loadProjects(supabase: SupabaseClient) {
  const { data } = await supabase.from("galleries").select("id, title, kind").is("deleted_at", null).order("created_at", { ascending: false }).limit(300);
  return (data ?? []) as { id: string; title: string; kind: "photo" | "video" }[];
}
