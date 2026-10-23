import { requireAdminPage } from "@/lib/auth";
import { formatCents, formatDay, quoteBadge, quoteState, todayParis } from "@/lib/finance";
import { loadExpenses, loadQuotes } from "@/lib/finance-data";
import { HoverLink } from "@/components/admin/hover-link";
import { MonthChart } from "@/components/admin/finance/month-chart";
import { NewQuoteButton, QuoteBadge } from "@/components/admin/finance/finance-parts";

export const dynamic = "force-dynamic";

export default async function FinancesPage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const { supabase } = await requireAdminPage();
  const today = todayParis();
  const thisYear = today.slice(0, 4);
  const year = /^\d{4}$/.test((await searchParams).annee ?? "") ? (await searchParams).annee! : thisYear;
  const [{ quotes, payments, paid }, expenses] = await Promise.all([loadQuotes(supabase), loadExpenses(supabase)]);

  const income = Array(12).fill(0) as number[];
  const spent = Array(12).fill(0) as number[];
  for (const p of payments) if (p.paid_on.startsWith(year)) income[Number(p.paid_on.slice(5, 7)) - 1] += p.amount_cents;
  for (const e of expenses) if (e.spent_on.startsWith(year)) spent[Number(e.spent_on.slice(5, 7)) - 1] += e.amount_cents;
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const month = Number(today.slice(5, 7)) - 1;

  const open = quotes.filter((q) => q.status === "sent" || q.status === "accepted");
  const states = new Map(open.map((q) => [q.id, quoteState(q, paid.get(q.id) ?? 0, today)]));
  const toCollect = open.reduce((s, q) => s + (q.status === "accepted" ? states.get(q.id)!.remaining : 0), 0);
  const pending = open.reduce((s, q) => s + (q.status === "sent" ? states.get(q.id)!.remaining : 0), 0);
  const overdue = open.filter((q) => states.get(q.id)!.overdue);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const lastPaid = new Map<string, string>();
  for (const p of payments) if (p.created_at && (lastPaid.get(p.quote_id) ?? "") < p.created_at) lastPaid.set(p.quote_id, p.created_at);

  // À relancer : clic sur « Payer » sans paiement noté depuis, en retard, acompte attendu, ou devis envoyé sans réponse depuis une semaine.
  const followUps = open
    .map((q) => {
      const s = states.get(q.id)!;
      const deposit = Math.round((q.total_cents * q.deposit_pct) / 100);
      const clicked = q.pay_clicked_at && s.remaining > 0 && (lastPaid.get(q.id) ?? "") < q.pay_clicked_at;
      const reason = clicked
        ? `A cliqué sur « Payer » le ${formatDay(q.pay_clicked_at!.slice(0, 10))} : vérifiez votre compte, puis notez le paiement`
        : s.overdue
        ? `Solde de ${formatCents(s.remaining)} attendu depuis le ${formatDay(q.due_on)}`
        : q.status === "accepted" && deposit > 0 && s.paid < deposit
          ? `Acompte de ${formatCents(deposit - s.paid)} pas encore reçu`
          : q.status === "sent" && !s.expired && (q.sent_at ?? q.created_at) < weekAgo && (q.last_reminder_at ?? "") < weekAgo
            ? "Envoyé il y a plus d'une semaine, sans réponse"
            : null;
      return reason ? { q, reason } : null;
    })
    .filter((x) => x !== null);

  const years = [...new Set([thisYear, ...payments.map((p) => p.paid_on.slice(0, 4)), ...expenses.map((e) => e.spent_on.slice(0, 4))])].sort().reverse();
  const recent = payments.slice(0, 6);
  const byId = new Map(quotes.map((q) => [q.id, q]));

  if (quotes.length === 0 && expenses.length === 0) {
    return (
      <div className="border border-line px-6 py-14 text-center">
        <p className="display text-2xl">Vos finances, au même endroit que vos projets</p>
        <p className="text-sm text-muted mt-3 max-w-md mx-auto leading-relaxed">
          Commencez par remplir vos infos dans <HoverLink href="/admin/finances/reglages" className="underline">Réglages</HoverLink> (nom, SIRET, TVA…), puis créez
          votre premier devis. Les paiements notés ici apparaîtront dans le tableau de bord.
        </p>
        <div className="mt-8 flex justify-center"><NewQuoteButton /></div>
      </div>
    );
  }

  return (
    <div className="space-y-14">
      <div className="flex flex-wrap items-center gap-3">
        {years.length > 1 && (
          <div className="flex gap-1">
            {years.map((y) => (
              <HoverLink key={y} href={y === thisYear ? "/admin/finances" : `/admin/finances?annee=${y}`} className={`px-3 py-1.5 text-xs border ${y === year ? "border-ink" : "border-line text-muted hover:text-ink"}`}>
                {y}
              </HoverLink>
            ))}
          </div>
        )}
        <div className="ml-auto"><NewQuoteButton /></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={`Encaissé en ${year}`} value={formatCents(sum(income), true)} />
        <Stat label={year === thisYear ? "Encaissé ce mois-ci" : "Dépenses"} value={formatCents(year === thisYear ? income[month] : sum(spent), true)} />
        <Stat label={`Résultat ${year}`} value={formatCents(sum(income) - sum(spent), true)} hint={`${formatCents(sum(spent), true)} de dépenses`} />
        <Stat
          label="Reste à encaisser"
          value={formatCents(toCollect, true)}
          hint={[pending > 0 && `+ ${formatCents(pending, true)} en devis envoyés`, overdue.length > 0 && `${overdue.length} en retard`].filter(Boolean).join(" · ") || undefined}
          tone={overdue.length > 0 ? "danger" : undefined}
        />
      </div>

      <section>
        <h2 className="eyebrow text-muted mb-6">Mois par mois</h2>
        <MonthChart income={income} expenses={spent} year={year} />
        <p className="text-xs text-muted mt-4 leading-relaxed">
          « Encaissé » = paiements reçus à leur date (c&apos;est en général ce que l&apos;on déclare à l&apos;URSSAF en micro-entreprise ; à confirmer avec votre comptable).
        </p>
      </section>

      <section>
        <h2 className="eyebrow text-muted mb-4">À relancer / à vérifier</h2>
        {followUps.length === 0 ? (
          <p className="text-sm text-muted py-6 border-t border-line">Rien à relancer pour l&apos;instant.</p>
        ) : (
          <ul>
            {followUps.map(({ q, reason }) => (
              <li key={q.id}>
                <HoverLink href={`/admin/finances/devis/${q.id}`} className="flex items-center gap-4 py-4 border-b border-line hover:opacity-80">
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] truncate">{q.client_name || "Client sans nom"}{q.title ? ` — ${q.title}` : ""}</span>
                    <span className="block text-xs text-muted mt-0.5">{reason}</span>
                  </span>
                  <QuoteBadge {...quoteBadge(q, paid.get(q.id) ?? 0)} />
                </HoverLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="eyebrow text-muted mb-4">Derniers paiements reçus</h2>
          <ul>
            {recent.map((p) => {
              const q = byId.get(p.quote_id);
              return (
                <li key={p.id} className="flex items-center gap-4 py-3 border-b border-line text-sm">
                  <span className="text-muted w-24 shrink-0">{formatDay(p.paid_on)}</span>
                  <HoverLink href={`/admin/finances/devis/${p.quote_id}`} className="flex-1 min-w-0 truncate hover:underline">
                    {q?.client_name || q?.number}{q?.title ? ` — ${q.title}` : ""}
                  </HoverLink>
                  <span className="tabular-nums">{formatCents(p.amount_cents)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" }) {
  return (
    <div className="border border-line px-4 py-5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`display text-3xl mt-1 tabular-nums ${tone === "danger" ? "text-danger" : ""}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}
