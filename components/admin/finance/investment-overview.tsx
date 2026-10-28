import { formatCents, type Expense, type Payment } from "@/lib/finance";

/**
 * Vision d'ensemble depuis le début : tout ce qui a été investi (dépenses, reventes déduites)
 * face à tout ce que les clients ont payé, et ce qu'il reste à récupérer pour être « remboursé ».
 */
export function InvestmentOverview({ expenses, payments, toCollect }: { expenses: Expense[]; payments: Payment[]; toCollect: number }) {
  const bought = expenses.reduce((s, e) => s + (e.is_resale ? 0 : e.amount_cents), 0);
  const resold = expenses.reduce((s, e) => s + (e.is_resale ? -e.amount_cents : 0), 0);
  const invested = bought - resold;
  const earned = payments.reduce((s, p) => s + p.amount_cents, 0);
  const left = invested - earned;
  const pct = invested > 0 ? Math.min(100, Math.round((earned / invested) * 100)) : 100;
  const afterCollect = left - toCollect;

  const years = [...new Set([...expenses.map((e) => e.spent_on.slice(0, 4)), ...payments.map((p) => p.paid_on.slice(0, 4))])].sort();
  let cumul = 0;
  const rows = years.map((y) => {
    const b = expenses.filter((e) => !e.is_resale && e.spent_on.startsWith(y)).reduce((s, e) => s + e.amount_cents, 0);
    const r = expenses.filter((e) => e.is_resale && e.spent_on.startsWith(y)).reduce((s, e) => s - e.amount_cents, 0);
    const p = payments.filter((x) => x.paid_on.startsWith(y)).reduce((s, x) => s + x.amount_cents, 0);
    cumul += b - r - p;
    return { y, b, r, p, cumul };
  });

  if (invested <= 0 && earned <= 0) return null;

  return (
    <section>
      <h2 className="eyebrow text-muted mb-6">Investissement depuis le début</h2>
      <div className="border border-line px-5 sm:px-8 py-7">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div>
            <p className="text-[11px] text-muted">{left > 0 ? "Reste à récupérer" : "Investissement remboursé"}</p>
            <p className={`display text-4xl sm:text-5xl mt-1 tabular-nums ${left > 0 ? "" : "text-accent"}`}>
              {left > 0 ? formatCents(left, true) : `+ ${formatCents(-left, true)}`}
            </p>
            <p className="text-xs text-muted mt-2">
              {left > 0
                ? toCollect > 0
                  ? afterCollect > 0
                    ? `Plus que ${formatCents(afterCollect, true)} une fois les ${formatCents(toCollect, true)} à encaisser reçus.`
                    : `Remboursé dès que les ${formatCents(toCollect, true)} à encaisser seront reçus.`
                  : "Ce que vos prestations doivent encore rapporter pour couvrir tout ce que vous avez investi."
                : "Vos prestations ont déjà rapporté plus que tout ce que vous avez investi : c'est du bénéfice."}
            </p>
          </div>
          <p className="text-right">
            <span className="display text-3xl tabular-nums text-muted">{pct} %</span>
            <span className="block text-[11px] text-muted">récupéré</span>
          </p>
        </div>

        <div className="mt-5 h-3 bg-bg-soft rounded-full overflow-hidden" role="img" aria-label={`${pct} % de l'investissement récupéré`}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--series-3)" }} />
        </div>

        <dl className="mt-7 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 text-sm">
          <Item label="Investi (achats, dépenses)" value={formatCents(bought, true)} />
          <Item label="Récupéré en reventes" value={resold > 0 ? `− ${formatCents(resold, true)}` : formatCents(0, true)} />
          <Item label="Investissement net" value={formatCents(invested, true)} strong />
          <Item label="Encaissé de vos clients" value={formatCents(earned, true)} strong />
        </dl>
      </div>

      {rows.length > 1 && (
        <div className="mt-6">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="text-xs text-muted text-left border-b border-line">
                <th className="py-2 font-normal">Année</th>
                <th className="py-2 font-normal text-right">Investi</th>
                <th className="py-2 font-normal text-right">Reventes</th>
                <th className="py-2 font-normal text-right">Encaissé</th>
                <th className="py-2 font-normal text-right">
                  <span className="sm:hidden">Reste</span>
                  <span className="hidden sm:inline">Reste à récupérer (fin d&apos;année)</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.y} className="border-b border-line">
                  <td className="py-2">{r.y}</td>
                  <td className="py-2 text-right tabular-nums">{formatCents(r.b, true)}</td>
                  <td className="py-2 text-right tabular-nums text-muted">{r.r > 0 ? `− ${formatCents(r.r, true)}` : "—"}</td>
                  <td className="py-2 text-right tabular-nums">{formatCents(r.p, true)}</td>
                  <td className={`py-2 text-right tabular-nums ${r.cumul > 0 ? "" : "text-accent"}`}>{r.cumul > 0 ? formatCents(r.cumul, true) : `+ ${formatCents(-r.cumul, true)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Item({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className={`mt-1 tabular-nums ${strong ? "text-lg" : ""}`}>{value}</dd>
    </div>
  );
}
