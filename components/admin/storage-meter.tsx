import { formatBytes } from "@/lib/format";

/** Couleurs des catégories (ordre fixe, vérifié pour les daltoniens) : `--series-1…5` dans globals.css. */
const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];

/**
 * Jauge d'espace de stockage Oracle utilisé. Avec `parts` : barre découpée par catégorie
 * (galeries, vidéos, tableaux, banque d'images) et légende avec l'espace de chacune.
 */
export function StorageMeter({ used, limit, parts }: { used: number; limit: number; parts?: { label: string; bytes: number }[] }) {
  const pct = Math.min(100, (used / limit) * 100);
  const level = pct >= 95 ? "danger" : pct >= 80 ? "warn" : "ok";
  const bar = level === "danger" ? "bg-danger" : level === "warn" ? "bg-amber-400" : "bg-emerald-500";
  const shown = parts?.filter((p) => p.bytes > 0) ?? [];
  return (
    <div className="border border-line px-4 py-4 sm:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow text-muted">Stockage</span>
        <span className="text-sm">
          {formatBytes(used)} <span className="text-muted">sur {formatBytes(limit)}</span>
        </span>
      </div>
      {parts ? (
        <div className="mt-3 h-2 bg-bg-soft rounded-full overflow-hidden flex gap-[2px]">
          {shown.map((p) => (
            <div
              key={p.label}
              title={`${p.label} : ${formatBytes(p.bytes)}`}
              className="h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-700"
              style={{ width: `${Math.max((p.bytes / limit) * 100, 0.6)}%`, background: SERIES[parts.indexOf(p)] }}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 h-1.5 bg-bg-soft rounded-full overflow-hidden">
          <div className={`h-full ${bar} rounded-full transition-[width] duration-700`} style={{ width: `${Math.max(pct, used > 0 ? 1 : 0)}%` }} />
        </div>
      )}
      <p className={`mt-2 text-xs ${level === "ok" ? "text-muted" : level === "warn" ? "text-warn" : "text-danger"}`}>
        {level === "ok" && `${Math.round(pct)} % utilisé · ${formatBytes(Math.max(0, limit - used))} disponibles`}
        {level === "warn" && `${Math.round(pct)} % utilisé : pensez à supprimer d'anciennes galeries.`}
        {level === "danger" && `${Math.round(pct)} % utilisé : stockage presque plein, les nouveaux envois seront bientôt bloqués.`}
      </p>
      {parts && (
        <ul className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-3">
          {parts.map((p, i) => (
            <li key={p.label} className="flex items-start gap-2 min-w-0">
              <span className="mt-1 w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ background: SERIES[i] }} aria-hidden />
              <span className="min-w-0">
                <span className="block text-xs text-muted truncate">{p.label}</span>
                <span className="block text-sm">
                  {formatBytes(p.bytes)}
                  {used > 0 && <span className="text-muted"> · {Math.round((p.bytes / used) * 100)} %</span>}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
