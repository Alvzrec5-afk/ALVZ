"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Collection, PhotoView } from "@/lib/types";
import { ChevronDown, DownloadIcon, HeartIcon, MoonIcon, SunIcon } from "@/components/icons";
import { Wordmark } from "@/components/wordmark";
import { JustifiedGrid } from "./justified-grid";
import { Lightbox } from "./lightbox";
import { downloadArchive } from "./zip";

type Props = {
  slug: string;
  title: string;
  date: string;
  theme: "light" | "dark";
  watermark: boolean;
  downloadsEnabled: boolean;
  cover: { src: string; width: number; height: number } | null;
  collections: Collection[];
  photos: PhotoView[];
  favorites: { email: string | null; photoIds: string[] };
};

const FAVORITES_TAB = "__favorites";

export function ClientGallery(props: Props) {
  const [theme, setTheme] = useState(props.theme);
  const [tab, setTab] = useState(props.collections[0]?.id ?? "");
  const [favorites, setFavorites] = useState(() => new Set(props.favorites.photoIds));
  const [email, setEmail] = useState(props.favorites.email);
  const [askEmailFor, setAskEmailFor] = useState<string | null | undefined>(undefined);
  const [open, setOpen] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [zip, setZip] = useState<{ done: number; total: number } | null>(null);
  const gridTop = useRef<HTMLDivElement>(null);

  // Préférence d'ambiance propre à chaque visiteur
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`theme:${props.slug}`);
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {}
  }, [props.slug]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      document.documentElement.dataset.theme = "dark";
    };
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(`theme:${props.slug}`, next);
    } catch {}
  };

  const visible = useMemo(
    () =>
      tab === FAVORITES_TAB
        ? props.photos.filter((p) => favorites.has(p.id))
        : props.photos.filter((p) => p.collectionId === tab),
    [tab, props.photos, favorites],
  );

  const persistFavorite = useCallback(
    async (id: string, on: boolean) => {
      setFavorites((s) => {
        const n = new Set(s);
        if (on) n.add(id);
        else n.delete(id);
        return n;
      });
      const res = await fetch(`/api/g/${props.slug}/favorites`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: id, on }),
      });
      if (!res.ok) {
        setFavorites((s) => {
          const n = new Set(s);
          if (on) n.delete(id);
          else n.add(id);
          return n;
        });
        if (res.status === 401) {
          setEmail(null);
          setAskEmailFor(id);
        }
      }
    },
    [props.slug],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      if (!email) return setAskEmailFor(id);
      persistFavorite(id, !favorites.has(id));
    },
    [email, favorites, persistFavorite],
  );

  const selectTab = (id: string) => {
    setTab(id);
    const top = gridTop.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) gridTop.current?.scrollIntoView({ behavior: "smooth" });
  };

  async function startZip(collectionId: string | null) {
    setMenu(false);
    try {
      await downloadArchive(props.slug, collectionId, (done, total) => setZip({ done, total }));
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setZip(null);
    }
  }

  const activeCollection = props.collections.find((c) => c.id === tab);

  return (
    <div data-theme={theme} className="min-h-svh bg-bg text-ink" onContextMenu={props.watermark ? (e) => (e.target as HTMLElement).tagName === "IMG" && e.preventDefault() : undefined}>
      {/* Couverture plein écran */}
      <section className="relative h-svh w-full overflow-hidden bg-black protect">
        {props.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.cover.src} alt="" className="absolute inset-0 w-full h-full object-cover animate-[coverIn_2.4s_ease-out_both]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/55" />
        <div className="absolute top-0 inset-x-0 flex justify-center pt-[max(env(safe-area-inset-top),1.75rem)] text-white/90">
          <Wordmark />
        </div>
        <div className="absolute inset-x-0 bottom-0 px-6 pb-[max(env(safe-area-inset-bottom),3.5rem)] sm:pb-24 text-center text-white">
          <h1 className="display text-[clamp(2.75rem,9vw,7.5rem)] uppercase tracking-[0.08em] break-words animate-[fadeUp_1.6s_0.3s_ease-out_both]">
            {props.title}
          </h1>
          {props.date && <p className="eyebrow mt-5 text-white/80 animate-[fadeUp_1.6s_0.6s_ease-out_both]">{props.date}</p>}
          <button
            onClick={() => gridTop.current?.scrollIntoView({ behavior: "smooth" })}
            className="mt-10 inline-flex flex-col items-center gap-2 eyebrow text-white/80 hover:text-white transition-colors animate-[fadeUp_1.6s_0.9s_ease-out_both]"
          >
            Voir la galerie
            <ChevronDown className="w-4 h-4 animate-bounce [animation-duration:2.4s]" />
          </button>
        </div>
      </section>

      <div ref={gridTop} className="scroll-mt-0" />

      {/* Barre de navigation discrète */}
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur-md border-b border-line">
        <div className="mx-auto max-w-[1800px] px-3 sm:px-8 h-14 sm:h-16 flex items-center gap-3">
          <div className="hidden md:block w-56 shrink-0 min-w-0">
            <p className="display text-lg truncate">{props.title}</p>
          </div>
          <nav className="flex-1 min-w-0 flex md:justify-center gap-6 overflow-x-auto no-scrollbar px-2">
            {props.collections.length > 1 &&
              props.collections.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectTab(c.id)}
                  className={`eyebrow whitespace-nowrap py-2 border-b transition-colors ${tab === c.id ? "border-ink" : "border-transparent text-muted hover:text-ink"}`}
                >
                  {c.name}
                </button>
              ))}
            {props.collections.length <= 1 && <span className="md:hidden display text-lg truncate">{props.title}</span>}
            {favorites.size > 0 && (
              <button
                onClick={() => selectTab(FAVORITES_TAB)}
                className={`eyebrow whitespace-nowrap py-2 border-b transition-colors flex items-center gap-1.5 ${tab === FAVORITES_TAB ? "border-ink" : "border-transparent text-muted hover:text-ink"}`}
              >
                <HeartIcon className="w-3.5 h-3.5" filled={tab === FAVORITES_TAB} /> Ma sélection {favorites.size}
              </button>
            )}
          </nav>
          <div className="flex items-center justify-end gap-0 md:w-56 shrink-0">
            {props.downloadsEnabled && (
              <div className="relative">
                <button className="icon-btn" onClick={() => setMenu((m) => !m)} aria-label="Télécharger" disabled={zip !== null}>
                  <DownloadIcon />
                </button>
                {menu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                    <div className="absolute right-0 mt-2 z-20 w-64 bg-bg border border-line shadow-xl py-2">
                      {activeCollection && props.collections.length > 1 && (
                        <button className="w-full text-left px-5 py-3 text-sm hover:bg-bg-soft" onClick={() => startZip(activeCollection.id)}>
                          Télécharger « {activeCollection.name} »
                        </button>
                      )}
                      <button className="w-full text-left px-5 py-3 text-sm hover:bg-bg-soft" onClick={() => startZip(null)}>
                        Télécharger toute la galerie
                      </button>
                      <p className="px-5 pt-2 pb-1 text-[11px] text-muted leading-snug">Photos en haute définition, au format ZIP.</p>
                    </div>
                  </>
                )}
              </div>
            )}
            <button className="icon-btn" onClick={toggleTheme} aria-label="Changer d'ambiance">
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1800px] px-1 sm:px-8 pt-1 sm:pt-8 pb-24 protect">
        {tab === FAVORITES_TAB && (
          <p className="text-center text-xs text-muted py-6">
            Sélection enregistrée pour {email}. Elle est automatiquement transmise à ALVZ.REC.
          </p>
        )}
        {visible.length === 0 ? (
          <p className="py-32 text-center display text-2xl text-muted">Aucune photo ici pour l&apos;instant.</p>
        ) : (
          <JustifiedGrid
            key={tab}
            photos={visible}
            favorites={favorites}
            onOpen={(id) => setOpen(visible.findIndex((p) => p.id === id))}
            onToggleFavorite={toggleFavorite}
          />
        )}
      </main>

      <footer className="pb-12 text-center">
        <Wordmark className="text-muted" />
      </footer>

      {open !== null && (
        <Lightbox
          photos={visible}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          downloadHref={props.downloadsEnabled ? (id) => `/api/g/${props.slug}/download?photo=${id}` : null}
        />
      )}

      {askEmailFor !== undefined && (
        <EmailDialog
          slug={props.slug}
          onCancel={() => setAskEmailFor(undefined)}
          onDone={(savedEmail, ids) => {
            setEmail(savedEmail);
            const set = new Set(ids);
            setFavorites(set);
            const pending = askEmailFor;
            setAskEmailFor(undefined);
            if (pending && !set.has(pending)) persistFavorite(pending, true);
          }}
        />
      )}

      {zip && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-ink text-bg px-5 py-3 text-xs tracking-wide shadow-xl">
          Préparation du ZIP… {zip.done}/{zip.total}
        </div>
      )}
    </div>
  );
}

function EmailDialog({ slug, onCancel, onDone }: { slug: string; onCancel: () => void; onDone: (email: string, ids: string[]) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch(`/api/g/${slug}/favorites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: value }),
    });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) return setError(json.error || "Une erreur est survenue");
    onDone(json.email, json.photoIds);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-bg text-ink px-7 pt-10 pb-[max(env(safe-area-inset-bottom),2rem)] sm:p-12 animate-[fadeUp_0.4s_ease-out_both]"
      >
        <HeartIcon className="w-5 h-5 mx-auto text-heart" filled />
        <h2 className="display text-3xl text-center mt-5">Vos favoris</h2>
        <p className="text-sm text-muted text-center mt-3 leading-relaxed">
          Indiquez votre e-mail pour enregistrer votre sélection et la retrouver plus tard.
        </p>
        <input
          type="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="vous@exemple.com"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="field mt-8 text-center"
        />
        {error && <p className="text-sm text-danger mt-3 text-center">{error}</p>}
        <div className="mt-8 flex gap-3">
          <button type="button" className="btn btn-ghost flex-1" onClick={onCancel}>Annuler</button>
          <button className="btn flex-1" disabled={pending}>{pending ? "…" : "Continuer"}</button>
        </div>
      </form>
    </div>
  );
}
