"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GridIcon, LockIcon, MenuIcon } from "@/components/icons";
import { formatBytes } from "@/lib/format";
import { trashGallery } from "@/app/admin/actions";
import { deleteInBackground, useHidden } from "./background";

export type GalleryCard = {
  id: string;
  slug: string;
  title: string;
  date: string;
  createdAt: string;
  photoCount: number;
  bytes: number;
  locked: boolean;
  expired: boolean;
  cover: string | null;
};

const SORTS = {
  recent: { label: "Plus récentes", fn: (a: GalleryCard, b: GalleryCard) => b.createdAt.localeCompare(a.createdAt) },
  oldest: { label: "Plus anciennes", fn: (a: GalleryCard, b: GalleryCard) => a.createdAt.localeCompare(b.createdAt) },
  name: { label: "Nom (A → Z)", fn: (a: GalleryCard, b: GalleryCard) => a.title.localeCompare(b.title, "fr") },
  size: { label: "Plus lourdes", fn: (a: GalleryCard, b: GalleryCard) => b.bytes - a.bytes },
} as const;

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" strokeLinecap="round" />
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden>
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
);
const SortIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden>
    <path d="M7 4v16m0 0-3-3m3 3 3-3M13 6h7M13 11h5M13 16h3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const DotsIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden>
    <circle cx="12" cy="5" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="12" cy="19" r="1.6" />
  </svg>
);

const LABELS = {
  photo: { title: "Galeries", one: "galerie", newHref: "/admin/galleries/new", newLabel: "Nouvelle galerie", first: "Créer votre première galerie", unit: "photo", empty: "Aucune photo", manage: "Gérer les photos", view: "Voir la galerie" },
  video: { title: "Vidéos", one: "projet", newHref: "/admin/videos/new", newLabel: "Nouveau projet", first: "Créer votre premier projet vidéo", unit: "vidéo", empty: "Aucune vidéo", manage: "Gérer les vidéos", view: "Voir comme le client" },
} as const;

export function GalleryGrid({ galleries: all, kind = "photo" }: { galleries: GalleryCard[]; kind?: "photo" | "video" }) {
  const hiddenIds = useHidden();
  const galleries = all.filter((g) => !hiddenIds.has(g.id)); // en cours de mise à la corbeille
  const L = LABELS[kind];
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sort, setSort] = useState<keyof typeof SORTS>("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  useEffect(() => {
    try {
      if (localStorage.getItem("studio-view") === "list") setView("list");
    } catch {}
  }, []);
  function changeView(v: "grid" | "list") {
    setView(v);
    try {
      localStorage.setItem("studio-view", v);
    } catch {}
  }
  const [menu, setMenu] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return galleries.filter((g) => !q || g.title.toLowerCase().includes(q)).sort(SORTS[sort].fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, hiddenIds.size, query, sort]);

  async function copyLink(g: GalleryCard) {
    await navigator.clipboard.writeText(`${window.location.origin}/g/${g.slug}`);
    setCopied(g.id);
    setMenu(null);
    setTimeout(() => setCopied(null), 2000);
  }

  async function remove(g: GalleryCard) {
    setMenu(null);
    if (!confirm(`Mettre « ${g.title} » à la corbeille ? Vous pourrez la restaurer pendant 30 jours.`)) return;
    try {
      deleteInBackground([g.id], () => trashGallery(g.id), () => router.refresh());
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {/* En-tête : titre, recherche, nouvelle galerie */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-10 min-w-0">
          <h1 className="display text-4xl sm:text-5xl">{L.title}</h1>
          <label className="hidden lg:flex items-center gap-3 text-muted w-72">
            <SearchIcon />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher" className="w-full bg-transparent outline-none text-[15px] text-ink placeholder:text-muted" />
          </label>
        </div>
        <div className="flex items-center gap-1 lg:hidden">
          <button className="icon-btn" onClick={() => setSearchOpen((o) => !o)} aria-label="Rechercher">
            <SearchIcon />
          </button>
          <Link href={L.newHref} className="icon-btn" aria-label={L.newLabel} title={L.newLabel}>
            <PlusIcon />
          </Link>
        </div>
        <span className="hidden lg:block">
          <Link href={L.newHref} className="btn">{L.newLabel}</Link>
        </span>
      </div>

      {searchOpen && (
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un client…"
          className="field mt-4 lg:hidden"
        />
      )}

      {/* Barre secondaire : nombre + tri */}
      <div className="mt-6 mb-8 flex items-center justify-between">
        <span className="eyebrow text-muted">
          {visible.length} {L.one}{visible.length > 1 ? "s" : ""}
        </span>
        <div className="relative flex items-center">
          <button
            className={`w-10 h-10 flex items-center justify-center transition-colors ${view === "grid" ? "text-ink" : "text-muted hover:text-ink"}`}
            onClick={() => changeView("grid")}
            aria-label="Affichage en grille"
            title="Grille"
          >
            <GridIcon />
          </button>
          <button
            className={`w-10 h-10 flex items-center justify-center transition-colors ${view === "list" ? "text-ink" : "text-muted hover:text-ink"}`}
            onClick={() => changeView("list")}
            aria-label="Affichage en liste"
            title="Liste"
          >
            <MenuIcon />
          </button>
          <span className="w-px h-5 bg-line mx-1" />
          <button className="icon-btn" onClick={() => setSortOpen((o) => !o)} aria-label="Trier">
            <SortIcon />
          </button>
          {sortOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-48 bg-bg-soft border border-line py-1 shadow-xl">
                {(Object.keys(SORTS) as (keyof typeof SORTS)[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      setSort(k);
                      setSortOpen(false);
                    }}
                    className={`block w-full text-left px-4 py-2.5 text-sm hover:bg-bg ${sort === k ? "text-ink" : "text-muted"}`}
                  >
                    {SORTS[k].label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {galleries.length === 0 ? (
        <Link href={L.newHref} className="block border border-dashed border-line py-24 text-center hover:border-ink transition-colors">
          <p className="display text-2xl">{L.first}</p>
          <p className="text-sm text-muted mt-3">Touchez ici ou le bouton + en haut.</p>
        </Link>
      ) : visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">Aucun résultat ne correspond à « {query} ».</p>
      ) : (
        <ul
          className={
            view === "grid"
              ? "grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-2.5 gap-y-6 sm:gap-x-5 sm:gap-y-9"
              : "border-t border-line"
          }
        >
          {visible.map((g) => {
            const status = (
              <span
                className={`inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${g.expired ? "bg-danger" : g.photoCount > 0 ? "bg-emerald-500" : "bg-muted"}`}
                title={g.expired ? "Expirée" : g.photoCount > 0 ? "En ligne" : "Vide"}
              />
            );
            const meta = (
              <>
                {status}
                {g.photoCount} {L.unit}{g.photoCount > 1 ? "s" : ""}
                {g.bytes > 0 && <span className={view === "grid" ? "hidden sm:inline" : ""}>· {formatBytes(g.bytes)}</span>}
                {g.locked && <LockIcon className="w-3 h-3" />}
              </>
            );
            const thumb = g.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.cover} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-[10px] text-muted text-center px-1">{L.empty}</span>
            );
            const dots = (
              <button
                onClick={() => setMenu(menu === g.id ? null : g.id)}
                className={
                  view === "grid"
                    ? "absolute top-0.5 right-0.5 w-8 h-8 flex items-center justify-center text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]"
                    : "w-10 h-10 flex items-center justify-center text-muted hover:text-ink shrink-0"
                }
                aria-label="Options"
              >
                <DotsIcon />
              </button>
            );
            return (
              <li key={g.id} className={`relative ${busy === g.id ? "opacity-40 pointer-events-none" : ""}`}>
                {view === "grid" ? (
                  <>
                    <div className="relative">
                      <Link href={`/admin/galleries/${g.id}`} className="group block aspect-square lg:aspect-[4/3] bg-bg-soft overflow-hidden">
                        {thumb}
                      </Link>
                      {dots}
                      {copied === g.id && <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5">Lien copié ✓</span>}
                    </div>
                    <Link href={`/admin/galleries/${g.id}`} className="block mt-2 sm:mt-3">
                      <h2 className="text-[13px] sm:text-base truncate">{g.title}</h2>
                      <p className="mt-0.5 sm:mt-1 flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-muted">{meta}</p>
                      {g.date && <p className="hidden sm:block text-[11px] text-muted mt-0.5">{g.date}</p>}
                    </Link>
                  </>
                ) : (
                  <div className="flex items-center gap-4 py-3 border-b border-line">
                    <Link href={`/admin/galleries/${g.id}`} className="group flex-1 min-w-0 flex items-center gap-4">
                      <span className="block w-16 h-16 sm:w-20 sm:h-20 shrink-0 bg-bg-soft overflow-hidden">{thumb}</span>
                      <span className="min-w-0">
                        <span className="block text-[15px] truncate">{g.title}</span>
                        <span className="mt-1 flex items-center gap-2 text-xs text-muted">{meta}</span>
                        {g.date && <span className="block text-[11px] text-muted mt-0.5">{g.date}</span>}
                      </span>
                    </Link>
                    {copied === g.id && <span className="text-[11px] text-accent shrink-0">Lien copié ✓</span>}
                    {dots}
                  </div>
                )}
                {menu === g.id && (
                  <>
                    <div className="fixed inset-0 z-40 bg-black/40 sm:bg-transparent" onClick={() => setMenu(null)} />
                    <div className="fixed inset-x-0 bottom-0 z-50 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:pb-1 sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-1.5 sm:top-10 sm:w-52 bg-bg-soft border-t sm:border border-line py-1 shadow-xl text-[15px] sm:text-sm animate-[fadeUp_0.2s_ease-out_both] sm:animate-none">
                      <p className="sm:hidden px-5 pt-3 pb-2 eyebrow text-muted truncate">{g.title}</p>
                      <button className="block w-full text-left px-5 sm:px-4 py-3.5 sm:py-2.5 hover:bg-bg" onClick={() => copyLink(g)}>Copier le lien client</button>
                      <a className="block px-5 sm:px-4 py-3.5 sm:py-2.5 hover:bg-bg" href={`/g/${g.slug}`} target="_blank" rel="noreferrer" onClick={() => setMenu(null)}>{L.view}</a>
                      <Link className="block px-5 sm:px-4 py-3.5 sm:py-2.5 hover:bg-bg" href={`/admin/galleries/${g.id}`}>{L.manage}</Link>
                      <button className="block w-full text-left px-5 sm:px-4 py-3.5 sm:py-2.5 text-danger hover:bg-bg" onClick={() => remove(g)}>Supprimer</button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
