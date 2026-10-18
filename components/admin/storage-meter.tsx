import { formatBytes } from "@/lib/format";

/** Jauge d'espace de stockage Oracle utilisé. */
export function StorageMeter({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, (used / limit) * 100);
  const level = pct >= 95 ? "danger" : pct >= 80 ? "warn" : "ok";
  const bar = level === "danger" ? "bg-danger" : level === "warn" ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="border border-line px-4 py-4 sm:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow text-muted">Stockage</span>
        <span className="text-sm">
          {formatBytes(used)} <span className="text-muted">sur {formatBytes(limit)}</span>
        </span>
      </div>
      <div className="mt-3 h-1.5 bg-bg-soft rounded-full overflow-hidden">
        <div className={`h-full ${bar} rounded-full transition-[width] duration-700`} style={{ width: `${Math.max(pct, used > 0 ? 1 : 0)}%` }} />
      </div>
      <p className={`mt-2 text-xs ${level === "ok" ? "text-muted" : level === "warn" ? "text-warn" : "text-danger"}`}>
        {level === "ok" && `${Math.round(pct)} % utilisé · ${formatBytes(Math.max(0, limit - used))} disponibles`}
        {level === "warn" && `${Math.round(pct)} % utilisé : pensez à supprimer d'anciennes galeries.`}
        {level === "danger" && `${Math.round(pct)} % utilisé : stockage presque plein, les nouveaux envois seront bientôt bloqués.`}
      </p>
    </div>
  );
}
