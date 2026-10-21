import { formatLongDate, toParisDateInput } from "@/lib/dates";
import { formatBytes } from "@/lib/format";
import { storageParts, type StudioOverview } from "@/lib/usage";
import { StorageAlert } from "@/components/admin/storage-meter";
import { BoardIcon, FilmIcon, GalleryIcon, ImageIcon } from "@/components/icons";
import { HoverLink } from "@/components/admin/hover-link";
import { StorageAudit } from "@/components/admin/storage-audit";
import { StorageLimit } from "@/components/admin/storage-limit";
import { CountUp, DashboardActions } from "@/components/admin/dashboard-parts";

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("fr-FR")} ${n > 1 ? many : one}`;

/** Couleurs des catégories (mêmes que la jauge, vérifiées pour les daltoniens) ; la 6e = fichiers oubliés. */
const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--muted)"];
const KIND = {
  photo: { label: "Galerie", color: "var(--series-1)", Icon: ImageIcon },
  video: { label: "Vidéo", color: "var(--series-2)", Icon: FilmIcon },
  board: { label: "Tableau", color: "var(--series-3)", Icon: BoardIcon },
} as const;

export type RecentItem = {
  id: string;
  kind: "photo" | "video" | "board";
  title: string;
  href: string;
  date: string;
  /** Jamais modifié depuis sa création (« Créé le » au lieu de « Modifié le »). */
  created: boolean;
  bytes: number;
  cover: string | null;
};

export type DashboardProps = {
  o: StudioOverview;
  usage: { total: number; untracked: number; limit: number; free: number; perGallery: Map<string, number> };
  /** Activité des 14 derniers jours (un nombre par jour, le plus ancien d'abord). */
  activity: { photos: number[]; videos: number[]; boards: number[]; library: number[] };
  recent: RecentItem[];
  galleries: { id: string; title: string; kind: string }[];
  boards: { id: string; title: string }[];
};

/** Petite courbe d'activité (14 jours) qui se dessine à l'ouverture. */
function Spark({ values, color }: { values: number[]; color: string }) {
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
function StorageArc({ parts, used, limit, free }: { parts: { label: string; bytes: number }[]; used: number; limit: number; free: number }) {
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

/** Accueil du studio : indicateurs animés, projets récents en images, stockage en demi-cercle, recherche ⌘K. */
export function StudioDashboard({ o, usage, activity, recent, galleries, boards }: DashboardProps) {
  const parts = storageParts(o, usage.untracked);
  const biggest = galleries
    .map((g) => ({ ...g, bytes: usage.perGallery.get(g.id) ?? 0 }))
    .filter((g) => g.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5);
  const max = biggest[0]?.bytes ?? 1;

  const tiles = [
    { label: "Photos", value: o.photos, sub: `dans ${plural(o.photo_galleries, "galerie", "galeries")}`, href: "/admin/galleries", Icon: ImageIcon, spark: activity.photos, color: "var(--series-1)" },
    { label: "Vidéos", value: o.videos, sub: `${plural(o.video_projects, "projet", "projets")} · ${plural(o.video_views_30d, "vue", "vues")}`, href: "/admin/videos", Icon: FilmIcon, spark: activity.videos, color: "var(--series-2)" },
    { label: "Tableaux", value: o.boards, sub: "moodboards, tournages", href: "/admin/boards", Icon: BoardIcon, spark: activity.boards, color: "var(--series-3)" },
    { label: "Banque", value: o.library_images, sub: "images réutilisables", href: "/admin/boards/library", Icon: GalleryIcon, spark: activity.library, color: "var(--series-4)" },
  ];

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="motion-safe:animate-[fadeUp_0.6s_ease-out_both]">
          <h1 className="display text-4xl sm:text-5xl">Studio</h1>
          <p className="text-sm text-muted mt-3">Vue d&apos;ensemble de vos galeries, vidéos et tableaux.</p>
        </div>
        <DashboardActions galleries={galleries} boards={boards} />
      </div>

      <div className="mt-8 empty:hidden">
        <StorageAlert used={usage.total} limit={usage.limit} />
      </div>

      {/* Indicateurs : grille à l'ordinateur, bande qu'on fait défiler au téléphone. */}
      <div className="mt-8 -mx-4 px-4 sm:mx-0 sm:px-0 flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-px sm:bg-line sm:border sm:border-line overflow-x-auto snap-x snap-mandatory [scrollbar-width:none]">
        {tiles.map((t, i) => (
          <HoverLink
            key={t.label}
            href={t.href}
            className="group shrink-0 w-[44%] sm:w-auto snap-start border border-line sm:border-0 bg-bg px-4 py-4 sm:px-5 sm:py-5 hover:bg-bg-soft transition-colors min-w-0 motion-safe:animate-[gridIn_0.5s_ease-out_both]"
            style={{ animationDelay: `${0.05 + i * 0.07}s` }}
          >
            <span className="flex items-center justify-between text-xs text-muted">
              {t.label}
              <t.Icon className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" />
            </span>
            <span className="mt-2 flex items-end justify-between gap-2">
              <CountUp value={t.value ?? 0} className="display text-3xl sm:text-4xl tabular-nums leading-none" />
              <span className="hidden sm:block">
                <Spark values={t.spark} color={t.color} />
              </span>
            </span>
            <span className="block text-xs text-muted mt-2 truncate">{t.sub}</span>
          </HoverLink>
        ))}
      </div>

      <div className="mt-12 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-10 lg:gap-12">
        <section>
          <h2 className="eyebrow text-muted mb-5">Récemment modifiés</h2>
          {recent.length ? (
            <>
              {/* Ordinateur : grandes cartes avec image. */}
              <ul className="hidden sm:grid sm:grid-cols-2 2xl:grid-cols-3 gap-4">
                {recent.map((r, i) => {
                  const k = KIND[r.kind];
                  return (
                    <li key={r.kind + r.id} className="motion-safe:animate-[gridIn_0.55s_ease-out_both]" style={{ animationDelay: `${0.15 + i * 0.07}s` }}>
                      <HoverLink href={r.href} className="group block border border-line bg-bg overflow-hidden hover:border-ink/30 transition-colors">
                        <span className="relative block aspect-[4/3] bg-bg-soft overflow-hidden">
                          {r.cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.cover} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
                          ) : (
                            <span className="absolute inset-0 flex items-center justify-center text-muted">
                              <k.Icon className="w-8 h-8 opacity-40" />
                            </span>
                          )}
                          <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-[4px] text-[12px] text-white shadow-sm" style={{ background: k.color }}>
                            {k.label}
                          </span>
                          {r.kind === "video" && (
                            <span className="absolute bottom-3 right-3 w-9 h-9 rounded-full border border-white/70 bg-black/40 text-white flex items-center justify-center backdrop-blur-sm">
                              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 ml-0.5" fill="currentColor" aria-hidden>
                                <path d="M7 5v14l12-7z" />
                              </svg>
                            </span>
                          )}
                        </span>
                        <span className="flex items-start justify-between gap-3 px-4 py-3.5">
                          <span className="min-w-0">
                            <span className="block truncate text-[15px]">{r.title}</span>
                            <span className="block text-xs text-muted mt-1">
                              {r.created ? "Créé" : "Modifié"} le {formatLongDate(toParisDateInput(r.date))}
                            </span>
                          </span>
                          {r.bytes > 0 && <span className="text-xs text-muted tabular-nums shrink-0 mt-0.5">{formatBytes(r.bytes)}</span>}
                        </span>
                      </HoverLink>
                    </li>
                  );
                })}
              </ul>
              {/* Téléphone : lignes avec vignette. */}
              <ul className="sm:hidden divide-y divide-line border-y border-line">
                {recent.map((r, i) => {
                  const k = KIND[r.kind];
                  return (
                    <li key={r.kind + r.id} className="motion-safe:animate-[gridIn_0.5s_ease-out_both]" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
                      <HoverLink href={r.href} className="flex items-center gap-3 py-3">
                        <span className="relative w-24 aspect-[4/3] shrink-0 bg-bg-soft overflow-hidden rounded-[3px]">
                          {r.cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.cover} alt="" loading="lazy" className="w-full h-full object-cover" />
                          ) : (
                            <span className="absolute inset-0 flex items-center justify-center text-muted">
                              <k.Icon className="w-5 h-5 opacity-40" />
                            </span>
                          )}
                          <span className="absolute left-0 inset-y-0 w-[3px]" style={{ background: k.color }} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{r.title}</span>
                          <span className="block text-xs text-muted mt-0.5">
                            {k.label}
                            {r.bytes > 0 && ` · ${formatBytes(r.bytes)}`}
                          </span>
                          <span className="block text-xs text-muted">
                            {r.created ? "Créé" : "Modifié"} le {formatLongDate(toParisDateInput(r.date))}
                          </span>
                        </span>
                      </HoverLink>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted">Rien pour l&apos;instant : créez une galerie, un projet vidéo ou un tableau.</p>
          )}
        </section>

        <aside id="stockage" className="scroll-mt-8 motion-safe:animate-[fadeUp_0.7s_ease-out_0.2s_both]">
          <h2 className="eyebrow text-muted mb-5">Stockage &amp; système</h2>
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

          <h3 className="eyebrow text-muted mt-8 mb-4">Ce qui prend le plus de place</h3>
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

          <div className="mt-8 border border-line p-5 space-y-4">
            <div>
              <p className="text-[15px]">Oracle Cloud</p>
              <p className="text-xs text-muted mt-1">Photos, vidéos et images des tableaux · 20 Go gratuits</p>
            </div>
            <StorageLimit limitGb={Math.round(usage.limit / 1024 ** 3)} compact />
            <StorageAudit compact />
          </div>
        </aside>
      </div>
    </div>
  );
}
