import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { QUOTE_FIELDS, type Payment, type Quote } from "@/lib/finance";
import { loadCatalog, loadFinanceSettings, loadProjects } from "@/lib/finance-data";
import { mailerConfigured } from "@/lib/mailer";
import { QuoteEditor } from "@/components/admin/finance/quote-editor";

export const dynamic = "force-dynamic";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase } = await requireAdminPage();
  const [{ data: quote }, { data: payments }, settings, projects, catalog] = await Promise.all([
    supabase.from("quotes").select(QUOTE_FIELDS).eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("quote_payments").select("id, quote_id, amount_cents, paid_on, method, note, created_at").eq("quote_id", id).order("paid_on"),
    loadFinanceSettings(supabase),
    loadProjects(supabase),
    loadCatalog(supabase),
  ]);
  if (!quote) notFound();
  const q = quote as Quote;
  return (
    <QuoteEditor
      quote={{ ...q, total_cents: Number(q.total_cents), vat_rate: Number(q.vat_rate) }}
      payments={((payments ?? []) as Payment[]).map((p) => ({ ...p, amount_cents: Number(p.amount_cents) }))}
      settings={settings}
      projects={projects}
      catalog={catalog.filter((c) => !c.archived)}
      mailer={mailerConfigured()}
    />
  );
}
