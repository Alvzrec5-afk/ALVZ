import { requireAdminPage } from "@/lib/auth";
import { quoteBadge, quoteState } from "@/lib/finance";
import { loadQuotes } from "@/lib/finance-data";
import { NewQuoteButton } from "@/components/admin/finance/finance-parts";
import { QuotesList, type QuoteRow } from "@/components/admin/finance/quotes-list";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const { supabase } = await requireAdminPage();
  const { quotes, paid } = await loadQuotes(supabase);
  const rows: QuoteRow[] = quotes.map((q) => {
    const p = paid.get(q.id) ?? 0;
    const s = quoteState(q, p);
    return {
      id: q.id,
      number: q.number,
      title: q.title,
      client: q.client_name,
      issued_on: q.issued_on,
      total: q.total_cents,
      paid: p,
      badge: quoteBadge(q, p),
      group: q.status === "draft" ? "draft" : s.settled ? "paid" : q.status === "sent" || q.status === "accepted" ? "open" : "closed",
    };
  });
  return (
    <div>
      <div className="flex justify-end mb-6"><NewQuoteButton /></div>
      <QuotesList rows={rows} />
    </div>
  );
}
