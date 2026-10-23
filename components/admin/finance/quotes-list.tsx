"use client";

import { useMemo, useState } from "react";
import { formatCents, formatDay } from "@/lib/finance";
import { HoverLink } from "@/components/admin/hover-link";
import { QuoteBadge } from "./finance-parts";

export type QuoteRow = {
  id: string;
  number: string;
  title: string;
  client: string;
  issued_on: string;
  total: number;
  paid: number;
  badge: { label: string; tone: "muted" | "accent" | "warn" | "danger" | "ink" };
  group: "draft" | "open" | "paid" | "closed";
};

const FILTERS = { all: "Tous", open: "En cours", paid: "Payés", draft: "Brouillons", closed: "Refusés / annulés" } as const;

export function QuotesList({ rows }: { rows: QuoteRow[] }) {
  const [filter, setFilter] = useState<keyof typeof FILTERS>("all");
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (filter === "all" || r.group === filter) && (!q || `${r.number} ${r.title} ${r.client}`.toLowerCase().includes(q)));
  }, [rows, filter, query]);

  if (rows.length === 0) return <p className="py-16 text-center text-sm text-muted border-t border-line">Aucun devis pour l&apos;instant.</p>;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((k) => {
          const n = k === "all" ? rows.length : rows.filter((r) => r.group === k).length;
          if (k !== "all" && n === 0) return null;
          return (
            <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 text-xs border ${filter === k ? "border-ink" : "border-line text-muted hover:text-ink"}`}>
              {FILTERS[k]} <span className="text-muted">{n}</span>
            </button>
          );
        })}
      </div>
      {rows.length > 8 && <input className="field mb-2" placeholder="Rechercher un client, un numéro…" value={query} onChange={(e) => setQuery(e.target.value)} />}
      <ul>
        {shown.map((r) => (
          <li key={r.id}>
            <HoverLink href={`/admin/finances/devis/${r.id}`} className="flex items-center gap-4 py-4 border-b border-line hover:opacity-80">
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] truncate">{r.client || "Client sans nom"}{r.title ? ` — ${r.title}` : ""}</span>
                <span className="block text-xs text-muted mt-0.5">
                  {r.number} · {formatDay(r.issued_on)}
                  {r.paid > 0 && r.paid < r.total ? ` · ${formatCents(r.paid)} reçus` : ""}
                </span>
              </span>
              <span className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 sm:gap-4 shrink-0">
                <span className="text-sm tabular-nums">{formatCents(r.total)}</span>
                <QuoteBadge {...r.badge} />
              </span>
            </HoverLink>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="py-10 text-center text-sm text-muted">Aucun devis ici.</p>}
    </div>
  );
}
