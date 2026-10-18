"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { themeAttr, type GalleryDesign } from "@/lib/design";
import type { Collection, PhotoView } from "@/lib/types";
import { ChevronDown, DownloadIcon, HeartIcon } from "@/components/icons";
import { Wordmark } from "@/components/wordmark";
import { PhotoGrid } from "./justified-grid";
import { Lightbox } from "./lightbox";
import { downloadArchive } from "./zip";

type Props = {
  slug: string;
  title: string;
  date: string;
  design: GalleryDesign;
  watermark: boolean;
  downloadsEnabled: boolean;
  downloadWebEnabled: boolean;
  favoritesEnabled: boolean;
  cover: { src: string; width: number; height: number } | null;
  collections: Collection[];
  photos: PhotoView[];
  favorites: { email: string | null; photoIds: string[] };
};

const FAVORITES_TAB = "__favorites";

export function ClientGallery(props: Props) {
  const { design } = props;
  const [tab, setTab] = useState(props.collections[0]?.id ?? "");
  const [favorites, setFavorites] = useState(() => new Set(props.favorites.photoIds));
  const [email, setEmail] = useState(props.favorites.email);
  const [askEmailFor, setAskEmailFor] = useState<string | null | undefined>(undefined);
  const [open, setOpen] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [zip, setZip] = useState<{ done: number; total: number } | null>(null);
  const gridTop = useRef<HTMLDivElement>(null);

  // Couleur de fond de la page (zones de rebond iPhone comprises)
  useEffect(() => {
    document.documentElement.dataset.theme = themeAttr(design);
    return () => {
      document.documentElement.dataset.theme = "auto";
    };
  }, [design]);

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
  const scrollToGrid = () => gridTop.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <div
      data-theme={themeAttr(design)}
      className={`fs-${design.font_style} min-h-svh bg-bg text-ink`}
      onContextMenu={props.watermark ? (e) => (e.target as HTMLElement).tagName === "IMG" && e.preventDefault() : undefined}
    >
      <Cover design={design} cover={props.cover} title={props.title} date={props.date} onEnter={scrollToGrid} />

      <div ref={gridTop} />

      {/* Barre de navigation discrète */}
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur-md border-b border-line">
        <div className="mx-auto max-w-[1800px] px-3 sm:px-8 h-14 sm:h-16 flex items-center gap-3">
          <div className="hidden md:block w-56 shrink-0 min-w-0">
            <p className="gallery-title text-base truncate">{props.title}</p>
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
            {props.collections.length <= 1 && <span className="md:hidden gallery-title text-base truncate">{props.title}</span>}
            {props.favoritesEnabled && favorites.size > 0 && (
              <button
                onClick={() => selectTab(FAVORITES_TAB)}
                className={`eyebrow whitespace-nowrap py-2 border-b transition-colors flex items-center gap-1.5 ${tab === FAVORITES_TAB ? "border-ink" : "border-transparent text-muted hover:text-ink"}`}
              >
                <HeartIcon className="w-3.5 h-3.5" filled={tab === FAVORITES_TAB} /> Ma sélection {favorites.size}
              </button>
            )}
          </nav>
          <div className="flex items-center justify-end md:w-56 shrink-0">
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
          <p className="py-32 text-center gallery-title text-2xl text-muted">Aucune photo ici pour l&apos;instant.</p>
        ) : (
          <PhotoGrid
            key={tab}
            photos={visible}
            style={design.grid_style}
            size={design.grid_size}
            spacing={design.grid_spacing}
            favorites={favorites}
            favoritesEnabled={props.favoritesEnabled}
            onOpen={(id) => setOpen(visible.findIndex((p) => p.id === id))}
            onToggleFavorite={toggleFavorite}
          />
        )}
      </main>

      <footer className="pb-12 text-center">
        <Wordmark height={44} className="opacity-80" />
      </footer>

      {open !== null && (
        <Lightbox
          photos={visible}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          favorites={favorites}
          favoritesEnabled={props.favoritesEnabled}
          onToggleFavorite={toggleFavorite}
          downloadHref={props.downloadsEnabled ? (id, size) => `/api/g/${props.slug}/download?photo=${id}${size === "web" ? "&size=web" : ""}` : null}
          webDownload={props.downloadWebEnabled}
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

/** Couverture selon la mise en page choisie dans le studio. */
function Cover({
  design,
  cover,
  title,
  date,
  onEnter,
}: {
  design: GalleryDesign;
  cover: Props["cover"];
  title: string;
  date: string;
  onEnter: () => void;
}) {
  const focus = { objectPosition: `${design.cover_focus_x}% ${design.cover_focus_y}%` };
  const img = (cls: string) =>
    cover ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={cover.src} alt="" className={`${cls} object-cover animate-[coverIn_2.4s_ease-out_both]`} style={focus} />
    ) : null;
  const enter = (light: boolean) => (
    <button
      onClick={onEnter}
      className={`mt-10 inline-flex flex-col items-center gap-2 eyebrow transition-colors animate-[fadeUp_1.6s_0.9s_ease-out_both] ${light ? "text-white/80 hover:text-white" : "text-muted hover:text-ink"}`}
    >
      Voir la galerie
      <ChevronDown className="w-4 h-4 animate-bounce [animation-duration:2.4s]" />
    </button>
  );
  const heading = (cls: string) => (
    <>
      <h1 className={`gallery-title break-words animate-[fadeUp_1.6s_0.3s_ease-out_both] ${cls}`}>{title}</h1>
      {date && <p className="eyebrow mt-5 opacity-80 animate-[fadeUp_1.6s_0.6s_ease-out_both]">{date}</p>}
    </>
  );

  if (design.cover_layout === "split") {
    return (
      <section className="min-h-svh flex flex-col-reverse md:flex-row protect">
        <div className="md:w-[42%] flex flex-col items-center justify-center text-center px-8 py-14 md:py-0">
          <Wordmark height={48} className="mb-12" />
          {heading("text-[clamp(2.2rem,5vw,4.5rem)]")}
          {enter(false)}
        </div>
        <div className="relative h-[62svh] md:h-auto md:flex-1 overflow-hidden bg-bg-soft">{img("absolute inset-0 w-full h-full")}</div>
      </section>
    );
  }

  if (design.cover_layout === "framed") {
    return (
      <section className="min-h-svh flex flex-col items-center px-5 sm:px-12 pt-[max(env(safe-area-inset-top),1.5rem)] pb-10 protect">
        <Wordmark height={40} className="mb-6" />
        <div className="relative w-full flex-1 min-h-[55svh] overflow-hidden bg-bg-soft">{img("absolute inset-0 w-full h-full")}</div>
        <div className="text-center pt-10">
          {heading("text-[clamp(2.2rem,6vw,5rem)]")}
          {enter(false)}
        </div>
      </section>
    );
  }

  const bottom = design.cover_layout === "bottom";
  return (
    <section className="relative h-svh w-full overflow-hidden bg-black protect">
      {img("absolute inset-0 w-full h-full")}
      <div className={`absolute inset-0 ${bottom ? "bg-gradient-to-b from-black/20 via-transparent to-black/70" : "bg-black/30"}`} />
      <div className="absolute top-0 inset-x-0 flex justify-center pt-[max(env(safe-area-inset-top),1.75rem)] text-white/90">
        <Wordmark height={44} tone="white" />
      </div>
      <div
        className={`absolute text-white px-6 sm:px-14 ${bottom ? "inset-x-0 bottom-0 pb-[max(env(safe-area-inset-bottom),3rem)] sm:pb-20 text-left" : "inset-0 flex flex-col items-center justify-center text-center"}`}
      >
        {heading("text-[clamp(2.6rem,9vw,7.5rem)]")}
        <div className={bottom ? "" : ""}>{enter(true)}</div>
      </div>
    </section>
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
