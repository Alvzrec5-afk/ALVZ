import { formatBytes } from "@/lib/format";
import { ORACLE_PRICE_PER_GB_MONTH } from "@/lib/storage-limits";

/** Couleurs des catégories (ordre fixe, vérifié pour les daltoniens) : `--series-1…5` dans globals.css. */
const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--muted)"];

/**
 * Jauge d'espace de stockage Oracle utilisé. Avec `parts` : barre découpée par catégorie
 * (galeries, vidéos, tableaux, banque d'images) et légende avec l'espace de chacune.
 */
export function StorageMeter({
  used,
  limit,
  parts,
  free,
}: {
  used: number;
  limit: number;
  parts?: { label: string; bytes: number }[];
  /** Partie gratuite d'Oracle : repère sur la barre quand la limite la dépasse (paiement à l'utilisation). */
  free?: number;
}) {
  const pct = Math.min(100, (used / limit) * 100);
  const paid = free && used > free ? used - free : 0;
  const freeMark = free && free < limit ? (free / limit) * 100 : null;
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
        <div className="relative mt-3">
        <div className="h-2 bg-bg-soft rounded-full overflow-hidden flex gap-[2px]">
          {shown.map((p) => (
            <div
              key={p.label}
              title={`${p.label} : ${formatBytes(p.bytes)}`}
              className="h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-700"
              style={{ width: `${Math.max((p.bytes / limit) * 100, 0.6)}%`, background: SERIES[parts.indexOf(p)] }}
            />
          ))}
        </div>
        {freeMark !== null && (
          <span
            className="absolute -top-1 -bottom-1 w-px bg-ink/60"
            style={{ left: `${freeMark}%` }}
            title={`${formatBytes(free!)} gratuits`}
            aria-hidden
          />
        )}
        </div>
      ) : (
        <div className="mt-3 h-1.5 bg-bg-soft rounded-full overflow-hidden">
          <div className={`h-full ${bar} rounded-full transition-[width] duration-700`} style={{ width: `${Math.max(pct, used > 0 ? 1 : 0)}%` }} />
        </div>
      )}
      <p className={`mt-2 text-xs ${level === "ok" ? "text-muted" : level === "warn" ? "text-warn" : "text-danger"}`}>
        {level === "ok" &&
          `${Math.round(pct)} % utilisé · ${formatBytes(Math.max(0, limit - used))} disponibles` +
            (freeMark !== null
              ? paid
                ? ` · ${formatBytes(paid)} au-delà des ${formatBytes(free!)} gratuits (environ ${(paid / 1024 ** 3 * ORACLE_PRICE_PER_GB_MONTH).toFixed(2).replace(".", ",")} $ par mois)`
                : ` · le trait marque les ${formatBytes(free!)} gratuits`
              : "")}
        {level === "warn" && `${Math.round(pct)} % utilisé : pensez à supprimer d'anciennes galeries ou à agrandir le stockage Oracle.`}
        {level === "danger" && `${Math.round(pct)} % utilisé : stockage presque plein, les nouveaux envois seront bientôt bloqués.`}
      </p>
      {parts && (
        <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-3">
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

/** Seuil de l'alerte (part de l'espace gratuit utilisée) : assez tôt pour avoir le temps de réagir. */
const ALERT_AT = 0.75;

/**
 * Alerte bien visible en haut de l'Accueil, des galeries et des vidéos quand le stockage approche de la limite
 * (au-delà, les envois sont refusés). Rien en dessous de 75 %.
 */
export function StorageAlert({ used, limit }: { used: number; limit: number }) {
  if (!limit || used < limit * ALERT_AT) return null;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const urgent = pct >= 95;
  return (
    <div role="status" className={`border px-4 py-4 sm:px-5 ${urgent ? "border-danger" : "border-warn"}`}>
      <p className={`text-sm font-medium ${urgent ? "text-danger" : "text-warn"}`}>
        {urgent ? "Stockage presque plein" : "Le stockage approche de la limite"} : {formatBytes(used)} sur {formatBytes(limit)} ({pct} %)
      </p>
      <p className="text-sm text-muted mt-2">
        {urgent ? "Les nouveaux envois (photos, vidéos, images des tableaux) seront bientôt refusés. " : ""}
        Pour continuer sans souci, au choix :
      </p>
      <ul className="text-sm text-muted mt-1 list-disc pl-5 space-y-1">
        <li>supprimer d&apos;anciennes galeries ou vidéos (voir « Ce qui prend le plus de place » sur l&apos;Accueil) ;</li>
        <li>
          relever la limite sur l&apos;Accueil, sous la jauge (compte Oracle en paiement à l&apos;utilisation : quelques centimes
          par Go et par mois au-delà des 20 Go gratuits).
        </li>
      </ul>
    </div>
  );
}
