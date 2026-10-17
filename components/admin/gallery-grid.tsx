"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LockIcon } from "@/components/icons";
import { formatBytes } from "@/lib/format";
import { purge } from "./purge";

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

export function GalleryGrid({ galleries }: { galleries: GalleryCard[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sort, setSort] = useState<keyof typeof SORTS>("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return galleries.filter((g) => !q || g.title.toLowerCase().includes(q)).sort(SORTS[sort].fn);
  }, [galleries, query, sort]);

  async function copyLink(g: GalleryCard) {
    await navigator.clipboard.writeText(`${window.location.origin}/g/${g.slug}`);
    setCopied(g.id);
    setMenu(null);
    setTimeout(() => setCopied(null), 2000);
  }

  async function remove(g: GalleryCard) {
    setMenu(null);
    if (!confirm(`Supprimer définitivement « ${g.title} » et ses ${g.photoCount} photos ?`)) return;
    setBusy(g.id);
    try {
      await purge("gallery", g.id);
      router.refresh();
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
        <h1 className="display text-4xl sm:text-5xl">Galeries</h1>
        <div className="flex items-center gap-1">
          <button className="icon-btn" onClick={() => setSearchOpen((o) => !o)} aria-label="Rechercher">
            <SearchIcon />
          </button>
          <Link href="/admin/galleries/new" className="icon-btn" aria-label="Nouvelle galerie" title="Nouvelle galerie">
            <PlusIcon />
          </Link>
        </div>
      </div>

      {searchOpen && (
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un client…"
          className="field mt-4"
        />
      )}

      {/* Barre secondaire : nombre + tri */}
      <div className="mt-6 mb-8 flex items-center justify-between">
        <span className="eyebrow text-muted">
          {visible.length} galerie{visible.length > 1 ? "s" : ""}
        </span>
        <div className="relative">
          <button className="icon-btn" onClick={() => setSortOpen((o) => !o)} aria-label="Trier">
            <SortIcon />
          </button>
          {sortOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-48 bg-bg-soft border border-line py-1 shadow-xl">
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
        <Link href="/admin/galleries/new" className="block border border-dashed border-line py-24 text-center hover:border-ink transition-colors">
          <p className="display text-2xl">Créer votre première galerie</p>
          <p className="text-sm text-muted mt-3">Touchez ici ou le bouton + en haut.</p>
        </Link>
      ) : visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">Aucune galerie ne correspond à « {query} ».</p>
      ) : (
        <ul className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10">
          {visible.map((g) => (
            <li key={g.id} className={busy === g.id ? "opacity-40 pointer-events-none" : ""}>
              <div className="relative">
                <Link href={`/admin/galleries/${g.id}`} className="group block aspect-square bg-bg-soft overflow-hidden">
                  {g.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.cover} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center eyebrow text-muted">Aucune photo</span>
                  )}
                </Link>
                <button
                  onClick={() => setMenu(menu === g.id ? null : g.id)}
                  className="absolute top-1.5 right-1.5 w-9 h-9 flex items-center justify-center text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]"
                  aria-label="Options"
                >
                  <DotsIcon />
                </button>
                {copied === g.id && (
                  <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[11px] px-2 py-1">Lien copié ✓</span>
                )}
                {menu === g.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                    <div className="absolute inset-x-1.5 sm:inset-x-auto sm:right-1.5 sm:w-52 top-11 z-20 bg-bg-soft border border-line py-1 shadow-xl text-[13px] sm:text-sm">
                      <button className="block w-full text-left px-4 py-2.5 hover:bg-bg" onClick={() => copyLink(g)}>Copier le lien client</button>
                      <a className="block px-4 py-2.5 hover:bg-bg" href={`/g/${g.slug}`} target="_blank" rel="noreferrer" onClick={() => setMenu(null)}>Voir la galerie</a>
                      <Link className="block px-4 py-2.5 hover:bg-bg" href={`/admin/galleries/${g.id}`}>Gérer les photos</Link>
                      <button className="block w-full text-left px-4 py-2.5 text-danger hover:bg-bg" onClick={() => remove(g)}>Supprimer</button>
                    </div>
                  </>
                )}
              </div>
              <Link href={`/admin/galleries/${g.id}`} className="block mt-3">
                <h2 className="text-[15px] sm:text-base truncate">{g.title}</h2>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${g.expired ? "bg-danger" : g.photoCount > 0 ? "bg-emerald-500" : "bg-muted"}`}
                    title={g.expired ? "Expirée" : g.photoCount > 0 ? "En ligne" : "Vide"}
                  />
                  {g.photoCount} photo{g.photoCount > 1 ? "s" : ""}
                  {g.bytes > 0 && <span>· {formatBytes(g.bytes)}</span>}
                  {g.locked && <LockIcon className="w-3 h-3" />}
                </p>
                {g.date && <p className="text-[11px] text-muted mt-0.5">{g.date}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
