import type { CalendarEntry } from "@/lib/calendar";
import { formatTime } from "@/lib/calendar";
import { formatCents, formatDay } from "@/lib/finance";
import type { StudioOverview } from "@/lib/usage";
import { StorageAlert } from "@/components/admin/storage-meter";
import { HoverLink } from "@/components/admin/hover-link";
import { CountUp, DashboardActions } from "@/components/admin/dashboard-parts";
import { StorageOverview, type StorageInfo } from "@/components/admin/studio-dashboard";
import { ChevronRight } from "@/components/icons";
import { RecentProjects, type RecentItem } from "@/components/admin/recent-projects";

export type CockpitData = {
  today: string;
  name: string;
  summary: { week: number; overdue: number; options: number };
  monthName: string;
  income: { cents: number; prev: number; spark: number[]; labels: string[] };
  toCollect: { cents: number; count: number; overdue: number };
  options: { cents: number; count: number };
  next: { title: string; date: string; days: number; option: boolean; id: string } | null;
  agenda: CalendarEntry[];
  goal: { cents: number; done: number; dueThisMonth: number } | null;
  payments: { id: string; date: string; label: string; cents: number; href: string }[];
};

const SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const longToday = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const euros = (cents: number) => Math.round(cents / 100);

/** Repère de couleur d'une date (même code que le Calendrier : noir confirmé, pointillés option, bleu iPhone…). */
const MARK: Record<CalendarEntry["tone"], string> = {
  event: "bg-ink",
  option: "border border-dashed border-muted",
  project: "bg-line",
  due: "bg-warn",
  overdue: "bg-danger",
  cancelled: "bg-line",
  external: "bg-[var(--series-1)]",
};

function entryHref(e: CalendarEntry) {
  if (e.eventId) return `/admin/calendrier?e=${e.eventId}&m=${e.date.slice(0, 7)}`;
  return e.href ?? `/admin/calendrier?m=${e.date.slice(0, 7)}`;
}

/** Courbe de l'encaissé sur 6 mois, qui se dessine à l'ouverture. */
function MoneySpark({ values, labels }: { values: number[]; labels: string[] }) {
  const w = 100;
  const h = 32;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - (v / max) * (h - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10 mt-3 overflow-visible" preserveAspectRatio="none" role="img" aria-label={`Encaissé : ${values.map((v, i) => `${labels[i]} ${formatCents(v, true)}`).join(", ")}`}>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="var(--series-3)" fillOpacity="0.1" className="motion-safe:animate-[fadeIn_1.2s_ease-out_0.5s_both]" />
      <path
        d={line}
        fill="none"
        stroke="var(--series-3)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="1"
        className="motion-safe:animate-[drawLine_1.1s_cubic-bezier(.2,.8,.2,1)_0.2s_both]"
      />
      {values.map((v, i) => (
        <circle key={i} cx={pts[i][0]} cy={pts[i][1]} r="6" fill="transparent">
          <title>{`${labels[i]} : ${formatCents(v)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function Tile({ href, label, children, sub, i }: { href: string; label: string; children: React.ReactNode; sub: React.ReactNode; i: number }) {
  return (
    <HoverLink
      href={href}
      className="group bg-bg px-4 py-4 sm:px-5 sm:py-5 hover:bg-bg-soft transition-colors min-w-0 motion-safe:animate-[gridIn_0.5s_ease-out_both]"
      style={{ animationDelay: `${0.05 + i * 0.07}s` }}
    >
      <span className="block text-[11px] text-muted">{label}</span>
      <span className="block mt-1">{children}</span>
      <span className="block text-[11px] text-muted mt-1 line-clamp-2 sm:line-clamp-1">{sub}</span>
    </HoverLink>
  );
}

/** Accueil « cockpit » : chiffres de l'argent, 14 prochains jours, objectif du mois, derniers paiements, stockage. */
export function HomeCockpit({
  data,
  o,
  usage,
  galleries,
  boards,
  recent = [],
  recentVariant = "rows",
}: {
  recent?: RecentItem[];
  recentVariant?: "rows" | "strip";
  data: CockpitData;
  o: StudioOverview;
  usage: StorageInfo;
  galleries: { id: string; title: string; kind: string }[];
  boards: { id: string; title: string }[];
}) {
  const { summary, income, toCollect, options, next, goal } = data;
  const trend = income.prev > 0 ? Math.round(((income.cents - income.prev) / income.prev) * 100) : null;
  const bits = [
    summary.week > 0 ? plural(summary.week, "prestation cette semaine", "prestations cette semaine") : "Aucune prestation cette semaine",
    summary.overdue > 0 ? { text: plural(summary.overdue, "paiement en retard", "paiements en retard"), danger: true } : null,
    summary.options > 0 ? plural(summary.options, "option à confirmer", "options à confirmer") : null,
  ].filter(Boolean) as (string | { text: string; danger: boolean })[];
  const goalPct = goal ? Math.min(100, Math.round((goal.done / goal.cents) * 100)) : 0;
  const goalLeft = goal ? Math.max(0, goal.cents - goal.done) : 0;

  return (
    <div className="space-y-12">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 motion-safe:animate-[fadeUp_0.6s_ease-out_both]">
          <p className="eyebrow text-muted first-letter:uppercase">{longToday(data.today)}</p>
          <h1 className="display text-4xl sm:text-5xl mt-2">Bonjour{data.name ? ` ${data.name}` : ""}</h1>
          <p className="text-sm text-muted mt-3 leading-relaxed">
            {bits.map((b, i) => (
              <span key={i}>
                {i > 0 && " · "}
                {typeof b === "string" ? b : <span className="text-danger">{b.text}</span>}
              </span>
            ))}
          </p>
        </div>
        <DashboardActions galleries={galleries} boards={boards} />
      </div>

      <div className="empty:hidden -mt-4">
        <StorageAlert used={usage.total} limit={usage.limit} />
      </div>

      {/* Les 4 chiffres. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
        <Tile i={0} href="/admin/finances" label={`Encaissé en ${data.monthName}`} sub={trend === null ? "Paiements notés ce mois-ci" : `${trend >= 0 ? "+" : ""}${trend} % par rapport au mois dernier`}>
          <span className="display text-3xl sm:text-4xl tabular-nums leading-none"><CountUp value={euros(income.cents)} /> €</span>
          <MoneySpark values={income.spark} labels={income.labels} />
        </Tile>
        <Tile
          i={1}
          href="/admin/finances/devis"
          label="À encaisser"
          sub={
            toCollect.count === 0 ? (
              "Rien en attente"
            ) : (
              <>
                {plural(toCollect.count, "devis accepté", "devis acceptés")}
                {toCollect.overdue > 0 && <span className="text-danger"> · {toCollect.overdue} en retard</span>}
              </>
            )
          }
        >
          <span className="display text-3xl sm:text-4xl tabular-nums leading-none"><CountUp value={euros(toCollect.cents)} /> €</span>
        </Tile>
        <Tile i={2} href="/admin/calendrier" label="En option" sub={options.count ? plural(options.count, "date à confirmer", "dates à confirmer") : "Aucune option en cours"}>
          <span className="display text-3xl sm:text-4xl tabular-nums leading-none"><CountUp value={euros(options.cents)} /> €</span>
        </Tile>
        <Tile
          i={3}
          href={next ? `/admin/calendrier?e=${next.id}&m=${next.date.slice(0, 7)}` : "/admin/calendrier"}
          label="Prochaine prestation"
          sub={next ? `${next.title}${next.option ? " (option)" : ""} · ${formatDay(next.date)}` : "Rien de prévu"}
        >
          <span className="display text-3xl sm:text-4xl leading-none">{next ? (next.days === 0 ? "Aujourd'hui" : next.days === 1 ? "Demain" : `J − ${next.days}`) : "—"}</span>
        </Tile>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-10 lg:gap-12">
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="eyebrow text-muted">14 prochains jours</h2>
            <HoverLink href="/admin/calendrier" className="text-xs text-muted hover:text-ink">Calendrier →</HoverLink>
          </div>
          {data.agenda.length ? (
            <ul>
              {data.agenda.map((e, i) => (
                <li key={e.key} className="motion-safe:animate-[gridIn_0.5s_ease-out_both]" style={{ animationDelay: `${0.1 + i * 0.04}s` }}>
                  <HoverLink href={entryHref(e)} className="flex items-center gap-4 py-3 border-b border-line hover:opacity-80">
                    <span className="w-10 text-center shrink-0">
                      <span className="block display text-2xl leading-none">{Number(e.date.slice(8))}</span>
                      <span className="block text-[10px] text-muted">{SHORT[Number(e.date.slice(5, 7)) - 1]}</span>
                    </span>
                    <span className={`w-1.5 self-stretch rounded-full shrink-0 ${MARK[e.tone]}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] truncate">{e.title}</span>
                      <span className="block text-xs text-muted truncate">
                        {[e.time && formatTime(e.time), e.tone === "option" ? "Option" : null, e.tone === "overdue" ? "En retard" : null, e.sub].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                  </HoverLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted py-4 border-t border-line">
              Rien de prévu. <HoverLink href="/admin/calendrier" className="underline">Ajouter un événement</HoverLink>
            </p>
          )}
        </section>

        <section className="space-y-10">
          <div>
            <h2 className="eyebrow text-muted mb-3">Objectif de {data.monthName}</h2>
            {goal ? (
              <div className="border border-line p-5">
                <div className="flex items-end justify-between gap-3">
                  <span className="display text-3xl tabular-nums">{formatCents(goal.done, true)}</span>
                  <span className="text-xs text-muted">sur {formatCents(goal.cents, true)}</span>
                </div>
                <div className="h-2 bg-bg-soft rounded-full mt-3 overflow-hidden" role="img" aria-label={`${goalPct} % de l'objectif`}>
                  <div className="h-full rounded-full origin-left motion-safe:animate-[lineIn_1s_cubic-bezier(.2,.8,.2,1)_0.3s_both]" style={{ width: `${goalPct}%`, background: "var(--series-3)" }} />
                </div>
                <p className="text-xs text-muted mt-2">
                  {goalLeft === 0
                    ? "Objectif atteint 🎉"
                    : `Encore ${formatCents(goalLeft, true)}${goal.dueThisMonth > 0 ? ` · ${formatCents(goal.dueThisMonth, true)} de soldes attendus ce mois-ci` : ""}.`}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted border border-line p-5">
                Fixez un objectif mensuel dans{" "}
                <HoverLink href="/admin/finances/reglages" className="underline">Finances → Réglages</HoverLink> pour suivre votre mois ici.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="eyebrow text-muted">Derniers paiements</h2>
              <HoverLink href="/admin/finances" className="text-xs text-muted hover:text-ink">Finances →</HoverLink>
            </div>
            {data.payments.length ? (
              <ul>
                {data.payments.map((p) => (
                  <li key={p.id}>
                    <HoverLink href={p.href} className="flex gap-4 py-2.5 border-b border-line text-sm hover:opacity-80">
                      <span className="text-muted w-16 shrink-0">{formatDay(p.date).replace(/ \d{4}$/, "")}</span>
                      <span className="flex-1 min-w-0 truncate">{p.label}</span>
                      <span className="tabular-nums text-accent shrink-0">+ {formatCents(p.cents, true)}</span>
                    </HoverLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted py-3 border-t border-line">Aucun paiement noté pour l&apos;instant.</p>
            )}
          </div>
        </section>
      </div>

      <RecentProjects items={recent} variant={recentVariant} />

      <StorageOverview o={o} usage={usage} galleries={galleries} />
    </div>
  );
}
