import { formatLongDate, toParisDateInput } from "@/lib/dates";
import { formatBytes } from "@/lib/format";
import { storageParts, type StudioOverview } from "@/lib/usage";
import { StorageAlert, StorageMeter } from "@/components/admin/storage-meter";
import { BoardIcon, FilmIcon, ImageIcon, PlusIcon } from "@/components/icons";
import { HoverLink } from "@/components/admin/hover-link";
import { StorageAudit } from "@/components/admin/storage-audit";

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("fr-FR")} ${n > 1 ? many : one}`;

export type DashboardProps = {
  o: StudioOverview;
  usage: { total: number; untracked: number; limit: number; perGallery: Map<string, number> };
  galleries: { id: string; title: string; kind: string; created_at: string }[];
  boards: { id: string; title: string; updated_at: string }[];
};

/** Accueil du studio : tous les chiffres d'un coup d'œil (centre de contrôle). */
export function StudioDashboard({ o, usage, galleries: list, boards }: DashboardProps) {
  const href = (g: { id: string }) => `/admin/galleries/${g.id}`;

  // Les galeries et projets qui prennent le plus de place (photos, vidéos et tableaux reliés compris).
  const biggest = list
    .map((g) => ({ ...g, bytes: usage.perGallery.get(g.id) ?? 0 }))
    .filter((g) => g.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 6);
  const max = biggest[0]?.bytes ?? 1;

  const tiles = [
    { label: "Photos", value: o.photos, sub: `dans ${plural(o.photo_galleries, "galerie", "galeries")}`, href: "/admin/galleries" },
    { label: "Vidéos", value: o.videos, sub: `dans ${plural(o.video_projects, "projet", "projets")}`, href: "/admin/videos" },
    { label: "Tableaux", value: o.boards, sub: "moodboards, tournages", href: "/admin/boards" },
    { label: "Banque d'images", value: o.library_images, sub: "images réutilisables", href: "/admin/boards/library" },
    { label: "Téléchargements", value: o.downloads_30d, sub: `30 derniers jours · ${plural(o.favorites, "favori", "favoris")}`, href: "/admin/galleries" },
    { label: "Vues vidéo", value: o.video_views_30d, sub: "30 derniers jours", href: "/admin/videos" },
    { label: "Site", value: o.site_items, sub: "photos sur alvzrec", href: "/admin/site" },
    { label: "Espace libre", value: null, text: formatBytes(Math.max(0, usage.limit - usage.total)), sub: `sur ${formatBytes(usage.limit)}`, href: "#stockage" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl">Studio</h1>
          <p className="text-sm text-muted mt-3">Vue d&apos;ensemble de vos galeries, vidéos et tableaux.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HoverLink href="/admin/galleries/new" className="btn">
            <PlusIcon className="w-4 h-4" /> Galerie
          </HoverLink>
          <HoverLink href="/admin/videos/new" className="btn">
            <PlusIcon className="w-4 h-4" /> Projet vidéo
          </HoverLink>
          <HoverLink href="/admin/boards/new" className="btn">
            <PlusIcon className="w-4 h-4" /> Tableau
          </HoverLink>
        </div>
      </div>

      <div className="mt-8 empty:hidden">
        <StorageAlert used={usage.total} limit={usage.limit} />
      </div>

      <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
        {tiles.map((t) => (
          <HoverLink key={t.label} href={t.href} className="bg-bg px-4 py-5 sm:px-5 hover:bg-bg-soft transition-colors min-w-0">
            <span className="block text-xs text-muted">{t.label}</span>
            <span className="block display text-3xl sm:text-4xl mt-1 tabular-nums">{t.text ?? (t.value ?? 0).toLocaleString("fr-FR")}</span>
            <span className="block text-xs text-muted mt-1 truncate">{t.sub}</span>
          </HoverLink>
        ))}
      </div>

      <div id="stockage" className="mt-8 scroll-mt-8">
        <StorageMeter used={usage.total} limit={usage.limit} parts={storageParts(o, usage.untracked)} />
        <StorageAudit />
      </div>

      <div className="mt-10 grid lg:grid-cols-2 gap-10">
        <section>
          <h2 className="eyebrow text-muted mb-4">Ce qui prend le plus de place</h2>
          {biggest.length ? (
            <ul className="space-y-3">
              {biggest.map((g) => (
                <li key={g.id}>
                  <HoverLink href={href(g)} className="block group">
                    <span className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate group-hover:underline underline-offset-2">
                        {g.title}
                        <span className="text-muted"> · {g.kind === "video" ? "Vidéo" : "Galerie"}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">{formatBytes(g.bytes)}</span>
                    </span>
                    <span className="mt-1.5 block h-1.5 bg-bg-soft rounded-full overflow-hidden">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${Math.max((g.bytes / max) * 100, 1)}%`, background: g.kind === "video" ? "var(--series-2)" : "var(--series-1)" }}
                      />
                    </span>
                  </HoverLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Rien pour l&apos;instant.</p>
          )}
        </section>

        <section>
          <h2 className="eyebrow text-muted mb-4">Récemment</h2>
          <ul className="divide-y divide-line border-y border-line">
            {list.slice(0, 5).map((g) => (
              <li key={g.id}>
                <HoverLink href={href(g)} className="flex items-center gap-3 py-3 hover:text-ink text-sm group">
                  {g.kind === "video" ? <FilmIcon className="w-4 h-4 text-muted shrink-0" /> : <ImageIcon className="w-4 h-4 text-muted shrink-0" />}
                  <span className="flex-1 truncate group-hover:underline underline-offset-2">{g.title}</span>
                  <span className="text-xs text-muted shrink-0">Créé le {formatLongDate(toParisDateInput(g.created_at))}</span>
                </HoverLink>
              </li>
            ))}
            {boards.map((b) => (
              <li key={b.id}>
                <HoverLink href={`/admin/boards/${b.id}`} className="flex items-center gap-3 py-3 text-sm group">
                  <BoardIcon className="w-4 h-4 text-muted shrink-0" />
                  <span className="flex-1 truncate group-hover:underline underline-offset-2">{b.title}</span>
                  <span className="text-xs text-muted shrink-0">Modifié le {formatLongDate(toParisDateInput(b.updated_at))}</span>
                </HoverLink>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
