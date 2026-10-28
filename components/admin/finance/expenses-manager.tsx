"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { EXPENSE_CATEGORIES, formatCents, formatDay, parseEuros, todayParis, type Expense } from "@/lib/finance";
import { addExpense, deleteExpense } from "@/app/admin/finance-actions";
import { TrashIcon } from "@/components/icons";
import { Segmented } from "@/components/admin/ui";

export function ExpensesManager({ expenses }: { expenses: Expense[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayParis());
  const [category, setCategory] = useState("materiel");
  const [kind, setKind] = useState<"buy" | "sale">("buy");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const year = todayParis().slice(0, 4);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) if (e.spent_on.startsWith(year)) m.set(e.category, (m.get(e.category) ?? 0) + e.amount_cents);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses, year]);
  const yearTotal = byCategory.reduce((s, [, v]) => s + v, 0);

  function add() {
    const cents = parseEuros(amount);
    if (!label.trim()) return setError(kind === "sale" ? "Indiquez ce que vous avez revendu." : "Indiquez ce que vous avez payé.");
    if (!cents || cents <= 0) return setError("Montant invalide.");
    start(async () => {
      const r = await addExpense({ label, category, amount_cents: cents, spent_on: date, note: "", is_resale: kind === "sale" });
      if (r.error) return setError(r.error);
      setError(null);
      setLabel("");
      setAmount("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-14">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className="eyebrow text-muted">{kind === "sale" ? "Noter une revente de matériel" : "Ajouter une dépense"}</h2>
          <Segmented value={kind} options={{ buy: "Achat", sale: "Revente" }} onChange={setKind} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-[1fr_8rem_10rem_11rem_auto] gap-3 items-end">
          <label className="block col-span-2 sm:col-span-1">
            <span className="label">Quoi</span>
            <input className="field" placeholder={kind === "sale" ? "Ex. Sony FX30 (Leboncoin)" : "Ex. Carte SD 128 Go, abonnement Adobe…"} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} onKeyDown={(e) => e.key === "Enter" && add()} />
          </label>
          <label className="block">
            <span className="label">{kind === "sale" ? "Vendu (€)" : "Montant (€)"}</span>
            <input className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          </label>
          <label className="block">
            <span className="label">Date</span>
            <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block col-span-2 sm:col-span-1">
            <span className="label">Catégorie</span>
            <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <button className="btn col-span-2 sm:col-span-1" onClick={add} disabled={busy}>{busy ? "…" : "Ajouter"}</button>
        </div>
        {error && <p className="text-sm text-danger mt-3">{error}</p>}
        {kind === "sale" && <p className="text-xs text-muted mt-3">Une revente est déduite de vos dépenses (elle ne compte pas comme un paiement client).</p>}
      </section>

      {byCategory.length > 0 && (
        <section>
          <h2 className="eyebrow text-muted mb-6">{year} par catégorie · {formatCents(yearTotal)}</h2>
          <ul className="space-y-3">
            {byCategory.map(([k, v]) => (
              <li key={k} className="grid grid-cols-[9rem_1fr_6rem] sm:grid-cols-[12rem_1fr_7rem] items-center gap-4 text-sm">
                <span className="truncate">{EXPENSE_CATEGORIES[k] ?? k}</span>
                <span className="h-2 bg-bg-soft rounded-full overflow-hidden">
                  <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, (v / Math.max(1, ...byCategory.map(([, x]) => x))) * 100))}%`, background: "var(--series-2)" }} />
                </span>
                <span className="text-right tabular-nums">{formatCents(v)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="eyebrow text-muted mb-4">Toutes les dépenses</h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted py-6 border-t border-line">Aucune dépense notée.</p>
        ) : (
          <ul>
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center gap-4 py-3 border-b border-line text-sm">
                <span className="text-muted w-24 shrink-0">{formatDay(e.spent_on)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{e.label}</span>
                  <span className="block text-xs text-muted">{e.is_resale ? "Revente · " : ""}{EXPENSE_CATEGORIES[e.category] ?? e.category}</span>
                </span>
                <span className={`tabular-nums whitespace-nowrap ${e.is_resale ? "text-accent" : ""}`}>
                  {e.is_resale ? `+ ${formatCents(-e.amount_cents)}` : formatCents(e.amount_cents)}
                </span>
                <button
                  className="icon-btn"
                  aria-label="Supprimer"
                  onClick={() => {
                    if (confirm(`Supprimer « ${e.label} » ?`)) start(async () => { await deleteExpense(e.id); router.refresh(); });
                  }}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
