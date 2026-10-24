import { formatLongDate, toParisDateInput } from "@/lib/dates";
import { formatBytes } from "@/lib/format";
import { HoverLink } from "@/components/admin/hover-link";
import { BoardIcon, FilmIcon, ImageIcon } from "@/components/icons";

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

const KIND = {
  photo: { label: "Galerie", color: "var(--series-1)", Icon: ImageIcon },
  video: { label: "Vidéo", color: "var(--series-2)", Icon: FilmIcon },
  board: { label: "Tableau", color: "var(--series-3)", Icon: BoardIcon },
} as const;

function Cover({ r, className }: { r: RecentItem; className: string }) {
  const k = KIND[r.kind];
  return (
    <span className={`relative block bg-bg-soft overflow-hidden ${className}`}>
      {r.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.cover} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-muted">
          <k.Icon className="w-6 h-6 opacity-40" />
        </span>
      )}
    </span>
  );
}

/** Projets récents (galeries, vidéos, tableaux) : en lignes (`rows`) ou en une bande de cartes qu'on fait défiler (`strip`). */
export function RecentProjects({ items, variant = "rows" }: { items: RecentItem[]; variant?: "rows" | "strip" }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="eyebrow text-muted mb-3">Projets récents</h2>
      {variant === "rows" ? (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
          {items.map((r, i) => {
            const k = KIND[r.kind];
            return (
              <li key={r.kind + r.id} className="min-w-0 motion-safe:animate-[gridIn_0.5s_ease-out_both]" style={{ animationDelay: `${0.1 + i * 0.05}s` }}>
                <HoverLink href={r.href} className="group flex items-center gap-4 py-3 border-b border-line">
                  <Cover r={r} className="w-20 aspect-[4/3] shrink-0 rounded-[3px]" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] truncate">{r.title}</span>
                    <span className="block text-xs text-muted mt-0.5 truncate">
                      {r.created ? "Créé" : "Modifié"} le {formatLongDate(toParisDateInput(r.date))}
                      {r.bytes > 0 && ` · ${formatBytes(r.bytes)}`}
                    </span>
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-[4px] text-white shrink-0" style={{ background: k.color }}>{k.label}</span>
                </HoverLink>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="-mx-5 px-5 scroll-px-5 sm:mx-0 sm:px-0 sm:scroll-px-0 flex gap-4 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] pb-1">
          {items.map((r, i) => {
            const k = KIND[r.kind];
            return (
              <li key={r.kind + r.id} className="shrink-0 w-[62%] sm:w-64 snap-start motion-safe:animate-[gridIn_0.5s_ease-out_both]" style={{ animationDelay: `${0.1 + i * 0.05}s` }}>
                <HoverLink href={r.href} className="group block">
                  <span className="relative block">
                    <Cover r={r} className="aspect-[4/3] rounded-[3px]" />
                    <span className="absolute top-2 right-2 text-[11px] px-2 py-0.5 rounded-[4px] text-white" style={{ background: k.color }}>{k.label}</span>
                  </span>
                  <span className="block text-sm mt-2 truncate">{r.title}</span>
                  <span className="block text-[11px] text-muted truncate">
                    {formatLongDate(toParisDateInput(r.date))}
                    {r.bytes > 0 && ` · ${formatBytes(r.bytes)}`}
                  </span>
                </HoverLink>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
