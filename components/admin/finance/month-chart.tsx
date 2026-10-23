"use client";

import { useState } from "react";
import { formatCents } from "@/lib/finance";

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const IN = "var(--series-3)";
const OUT = "var(--series-2)";

/** Encaissé et dépenses par mois (barres côte à côte, même échelle), détail au survol et tableau des chiffres. */
export function MonthChart({ income, expenses, year }: { income: number[]; expenses: number[]; year: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...income, ...expenses);
  // Paliers ronds de l'axe (en euros).
  const step = niceStep(max / 100 / 3);
  const top = Math.max(step, Math.ceil(max / 100 / step) * step);
  const ticks = [0, 1, 2, 3].map((i) => (top / 3) * i).filter((t, i, a) => a.indexOf(t) === i);
  const H = 180;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted mb-4">
        <span className="flex items-center gap-2"><i className="w-3 h-3 rounded-sm" style={{ background: IN }} /> Encaissé</span>
        <span className="flex items-center gap-2"><i className="w-3 h-3 rounded-sm" style={{ background: OUT }} /> Dépenses</span>
        <button className="ml-auto hover:text-ink" onClick={() => setTable((t) => !t)}>{table ? "Voir le graphique" : "Voir les chiffres"}</button>
      </div>

      {table ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted text-left border-b border-line">
              <th className="py-2 font-normal">Mois</th>
              <th className="py-2 font-normal text-right">Encaissé</th>
              <th className="py-2 font-normal text-right">Dépenses</th>
              <th className="py-2 font-normal text-right">Résultat</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((m, i) => (
              <tr key={m} className="border-b border-line">
                <td className="py-2">{m} {year}</td>
                <td className="py-2 text-right tabular-nums">{formatCents(income[i])}</td>
                <td className="py-2 text-right tabular-nums">{formatCents(expenses[i])}</td>
                <td className="py-2 text-right tabular-nums">{formatCents(income[i] - expenses[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative pl-12" onMouseLeave={() => setHover(null)}>
          {/* Grille et axe : discrets. */}
          <div className="absolute left-0 right-0 top-0" style={{ height: H }} aria-hidden>
            {ticks.map((t) => (
              <div key={t} className="absolute left-0 right-0 flex items-center translate-y-1/2" style={{ bottom: (t / top) * H }}>
                <span className="w-11 pr-2 text-right text-[10px] text-muted tabular-nums -translate-y-px">{formatCents(t * 100, true)}</span>
                <span className={`flex-1 border-t ${t === 0 ? "border-muted/60" : "border-line"}`} />
              </div>
            ))}
          </div>
          <div className="relative grid grid-cols-12" style={{ height: H }} role="img" aria-label={`Encaissé et dépenses par mois en ${year}`}>
            {MONTHS.map((m, i) => (
              <div key={m} className="relative flex items-end justify-center gap-[2px] h-full" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
                {[income[i], expenses[i]].map((v, k) => (
                  <span
                    key={k}
                    className="w-[30%] max-w-4 rounded-t-[4px] transition-opacity motion-safe:animate-[fadeIn_0.5s_ease-out_both]"
                    style={{
                      height: v > 0 ? Math.max(2, (v / 100 / top) * H) : 0,
                      background: k ? OUT : IN,
                      opacity: hover === null || hover === i ? 1 : 0.35,
                      animationDelay: `${i * 30}ms`,
                    }}
                  />
                ))}
                {hover === i && (
                  <div className={`absolute top-0 z-10 w-max border border-line bg-bg px-3 py-2 text-xs shadow-sm pointer-events-none ${i > 8 ? "right-0" : i < 3 ? "left-0" : "left-1/2 -translate-x-1/2"}`}>
                    <p className="text-muted mb-1">{m} {year}</p>
                    <p className="flex items-center gap-2"><i className="w-2 h-2 rounded-sm" style={{ background: IN }} /> Encaissé <b className="ml-auto pl-3 font-medium tabular-nums">{formatCents(income[i])}</b></p>
                    <p className="flex items-center gap-2"><i className="w-2 h-2 rounded-sm" style={{ background: OUT }} /> Dépenses <b className="ml-auto pl-3 font-medium tabular-nums">{formatCents(expenses[i])}</b></p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-12 mt-2 text-[10px] text-muted text-center">
            {MONTHS.map((m) => (
              <span key={m}>{m.replace(".", "")}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function niceStep(raw: number) {
  if (raw <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
