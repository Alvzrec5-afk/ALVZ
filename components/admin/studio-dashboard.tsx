import { formatBytes } from "@/lib/format";
import { storageParts, type StudioOverview } from "@/lib/usage";
import { HoverLink } from "@/components/admin/hover-link";
import { StorageAudit } from "@/components/admin/storage-audit";
import { StorageLimit } from "@/components/admin/storage-limit";

/** Couleurs des catégories (mêmes que la jauge, vérifiées pour les daltoniens) ; la 6e = fichiers oubliés. */
export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--muted)"];
export type StorageInfo = { total: number; untracked: number; limit: number; free: number; perGallery: Map<string, number> };

/** Petite courbe d'activité (14 jours) qui se dessine à l'ouverture. */
export function Spark({ values, color }: { values: number[]; color: string }) {
  const w = 72;
  const h = 26;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - (v / max) * (h - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const id = `sp${color.replace(/\W/g, "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="shrink-0 overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} className="motion-safe:animate-[fadeIn_1.2s_ease-out_0.5s_both]" />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="1"
        className="motion-safe:animate-[drawLine_1.1s_cubic-bezier(.2,.8,.2,1)_0.2s_both]"
      />
    </svg>
  );
}

/** Jauge en demi-cercle : une couleur par catégorie, remplie à l'ouverture. */
export function StorageArc({ parts, used, limit, free }: { parts: { label: string; bytes: number }[]; used: number; limit: number; free: number }) {
  const r = 80;
  const arc = `M ${100 - r},100 A ${r},${r} 0 0 1 ${100 + r},100`;
  let start = 0;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const freeMark = free < limit ? free / limit : null;
  return (
    <div className="relative">
      <svg viewBox="0 0 200 112" className="w-full max-w-[280px] mx-auto block" aria-hidden>
        <path d={arc} fill="none" stroke="var(--bg-soft)" strokeWidth="14" strokeLinecap="round" />
        {parts.map((p, i) => {
          const len = Math.min(1 - start, p.bytes / limit);
          if (len <= 0.002) return null;
          const seg = (
            <path
              key={p.label}
              d={arc}
              fill="none"
              stroke={SERIES[i]}
              strokeWidth="14"
              pathLength={1}
              strokeDasharray={`${Math.max(len - 0.006, 0.004)} 2`}
              strokeDashoffset={-start}
              className="motion-safe:animate-[fadeIn_0.6s_ease-out_both]"
              style={{ animationDelay: `${0.25 + i * 0.12}s` }}
            >
              <title>{`${p.label} : ${formatBytes(p.bytes)}`}</title>
            </path>
          );
          start += len;
          return seg;
        })}
        {freeMark !== null && (
          <line
            x1={100 - (r + 11) * Math.cos(Math.PI * freeMark)}
            y1={100 - (r + 11) * Math.sin(Math.PI * freeMark)}
            x2={100 - (r - 11) * Math.cos(Math.PI * freeMark)}
            y2={100 - (r - 11) * Math.sin(Math.PI * freeMark)}
            stroke="var(--ink)"
            strokeOpacity="0.6"
          />
        )}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="text-[15px] tabular-nums">
          {formatBytes(used)} <span className="text-muted">sur {formatBytes(limit)}</span>
        </p>
        <p className="text-xs text-muted mt-0.5">
          {pct} % · {formatBytes(Math.max(0, limit - used))} disponibles
        </p>
      </div>
    </div>
  );
}

/**
 * Stockage (bas de l'Accueil) : jauge en demi-cercle par catégorie, ce qui prend le plus de place, carte Oracle
 * (limite des envois, analyse de l'espace réel).
 */
export function StorageOverview({ o, usage, galleries }: { o: StudioOverview; usage: StorageInfo; galleries: { id: string; title: string; kind: string }[] }) {
  const parts = storageParts(o, usage.untracked);
  const biggest = galleries
    .map((g) => ({ ...g, bytes: usage.perGallery.get(g.id) ?? 0 }))
    .filter((g) => g.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5);
  const max = biggest[0]?.bytes ?? 1;
  return (
    <section id="stockage" className="scroll-mt-8">
      <h2 className="eyebrow text-muted mb-5">Stockage</h2>
      <div className="grid md:grid-cols-3 gap-8 items-start">
        <div className="border border-line px-5 pt-6 pb-5">
          <StorageArc parts={parts} used={usage.total} limit={usage.limit} free={usage.free} />
          <ul className="mt-5 space-y-1.5">
            {parts.map((p, i) =>
              p.bytes > 0 ? (
                <li key={p.label} className="flex items-center gap-2 text-xs min-w-0">
                  <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: SERIES[i] }} aria-hidden />
                  <span className="truncate text-muted">{p.label}</span>
                  <span className="ml-auto tabular-nums">{formatBytes(p.bytes)}</span>
                </li>
              ) : null,
            )}
          </ul>
        </div>
        <div>
          <h3 className="eyebrow text-muted mb-4">Ce qui prend le plus de place</h3>
          {biggest.length ? (
            <ul className="space-y-3.5">
              {biggest.map((g, i) => (
                <li key={g.id}>
                  <HoverLink href={`/admin/galleries/${g.id}`} className="block group">
                    <span className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate group-hover:underline underline-offset-2">{g.title}</span>
                      <span className="shrink-0 tabular-nums text-muted">{formatBytes(g.bytes)}</span>
                    </span>
                    <span className="mt-1.5 block h-1 bg-bg-soft rounded-full overflow-hidden">
                      <span
                        className="block h-full rounded-full origin-left motion-safe:animate-[lineIn_0.9s_cubic-bezier(.2,.8,.2,1)_both]"
                        style={{ width: `${Math.max((g.bytes / max) * 100, 2)}%`, background: g.kind === "video" ? "var(--series-2)" : "var(--series-1)", animationDelay: `${0.4 + i * 0.1}s` }}
                      />
                    </span>
                  </HoverLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Rien pour l&apos;instant.</p>
          )}
        </div>
        <div className="border border-line p-5 space-y-4">
          <div>
            <p className="text-[15px]">Oracle Cloud</p>
            <p className="text-xs text-muted mt-1">Photos, vidéos et images des tableaux · 20 Go gratuits</p>
          </div>
          <StorageLimit limitGb={Math.round(usage.limit / 1024 ** 3)} compact />
          <StorageAudit compact />
        </div>
      </div>
    </section>
  );
}
