"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { themeAttr, type GalleryDesign } from "@/lib/design";
import type { Collection, PhotoView } from "@/lib/types";
import { DownloadIcon, HeartIcon } from "@/components/icons";
import { Wordmark } from "@/components/wordmark";
import { PhotoGrid } from "./justified-grid";
import { Lightbox } from "./lightbox";
import { ContactCard, ContactSheet } from "./contact-card";
import { contactLinks } from "@/lib/contact";
import type { Contact } from "@/lib/contact";
import { downloadArchive } from "./zip";
import { VideoCards, type VideoCard } from "./video-cards";

type Props = {
  slug: string;
  title: string;
  date: string;
  design: GalleryDesign;
  watermark: boolean;
  downloadsEnabled: boolean;
  downloadWebEnabled: boolean;
  /** Le client donne son e-mail avant de télécharger. */
  downloadEmailRequired?: boolean;
  /** Devis lié pas encore réglé : téléchargement disponible après le paiement. */
  paymentPending?: boolean;
  /** Téléchargement de toute la galerie / d'une collection en ZIP (sinon photo par photo seulement). */
  zipEnabled?: boolean;
  favoritesEnabled: boolean;
  /** Recherche par selfie (« Trouver mes photos »). */
  faceSearch?: boolean;
  cover: { src: string; width: number; height: number } | null;
  /** Deuxième photo (mise en page Diptyque). */
  coverAlt: string | null;
  contact: Contact | null;
  collections: Collection[];
  photos: PhotoView[];
  videos: VideoCard[];
  favorites: { email: string | null; photoIds: string[] };
};

const FAVORITES_TAB = "__favorites";
const FACES_TAB = "__faces";
const VIDEOS_TAB = "__videos";

export function ClientGallery(props: Props) {
  const { design } = props;
  const [tab, setTab] = useState(props.collections[0]?.id ?? (props.videos.length ? VIDEOS_TAB : ""));
  const [favorites, setFavorites] = useState(() => new Set(props.favorites.photoIds));
  const [email, setEmail] = useState(props.favorites.email);
  const [askEmailFor, setAskEmailFor] = useState<string | null | undefined>(undefined);
  // Téléchargement en attente de l'e-mail du client (option de la galerie).
  const [askDownload, setAskDownload] = useState<(() => void) | null>(null);
  const needEmail = Boolean(props.downloadEmailRequired) && !email;
  const [open, setOpen] = useState<number | null>(null);
  const zipAllowed = props.downloadsEnabled && props.zipEnabled !== false;
  const [menu, setMenu] = useState(false);
  const [zip, setZip] = useState<{ done: number; total: number } | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const canContact = design.show_contact && props.contact !== null && contactLinks(props.contact).length > 0;
  const gridTop = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  // Trait sous l'onglet actif, qui glisse d'une collection à l'autre
  useEffect(() => {
    const nav = navRef.current;
    const measure = () => {
      const active = nav?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(tab)}"]`);
      setIndicator(active ? { left: active.offsetLeft, width: active.offsetWidth } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [tab, favorites.size, props.collections.length]);

  // Pas de zoom sur la grille de la galerie (pincement, double-tap). Photo ouverte : zoom normal du navigateur.
  // Si la page est restée zoomée (photo fermée en zoom), on laisse dézoomer.
  const lightboxOpen = useRef(false);
  lightboxOpen.current = open !== null;
  useEffect(() => {
    const blocked = () => !lightboxOpen.current && (window.visualViewport?.scale ?? 1) <= 1.01;
    const stop = (e: Event) => {
      if (blocked()) e.preventDefault(); // Safari (iPhone, iPad) : gestes de zoom
    };
    const twoFingers = (e: TouchEvent) => {
      if (e.touches.length > 1 && blocked()) e.preventDefault();
    };
    document.addEventListener("gesturestart", stop, { passive: false });
    document.addEventListener("gesturechange", stop, { passive: false });
    document.addEventListener("touchmove", twoFingers, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("gesturechange", stop);
      document.removeEventListener("touchmove", twoFingers);
    };
  }, []);

  // Couleur de fond de la page (zones de rebond iPhone comprises)
  useEffect(() => {
    document.documentElement.dataset.theme = themeAttr(design);
    return () => {
      document.documentElement.dataset.theme = "auto";
    };
  }, [design]);

  // Photos trouvées par le selfie, de la plus ressemblante à la moins ressemblante.
  const [faceMatches, setFaceMatches] = useState<string[] | null>(null);
  // Mode réglage (studio connecté seulement) : distance de chaque photo trouvée.
  const [faceDebug, setFaceDebug] = useState<{ distances: number[]; threshold: number } | null>(null);
  const [faceOpen, setFaceOpen] = useState(false);
  const visible = useMemo(() => {
    if (tab === FACES_TAB) {
      const byId = new Map(props.photos.map((p) => [p.id, p]));
      return (faceMatches ?? []).map((id) => byId.get(id)).filter((p): p is PhotoView => Boolean(p));
    }
    return tab === FAVORITES_TAB ? props.photos.filter((p) => favorites.has(p.id)) : props.photos.filter((p) => p.collectionId === tab);
  }, [tab, props.photos, favorites, faceMatches]);

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

  async function startZip(collectionId: string | null, emailGiven = false) {
    setMenu(false);
    if (needEmail && !emailGiven) return setAskDownload(() => () => startZip(collectionId, true));
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
      // overflow-x: clip : rien ne doit élargir la page au-delà de l'écran (sinon Safari dézoome toute la galerie) ;
      // « clip » et non « hidden », qui casserait l'en-tête collant.
      className={`fs-${design.font_style} min-h-svh bg-bg text-ink overflow-x-clip`}
      style={{ touchAction: open === null ? "pan-x pan-y" : "auto" }}
      onContextMenu={props.watermark ? (e) => (e.target as HTMLElement).tagName === "IMG" && e.preventDefault() : undefined}
    >
      <Cover design={design} cover={props.cover} coverAlt={props.coverAlt} title={props.title} date={props.date} onEnter={scrollToGrid} />

      <div ref={gridTop} />

      {/* En-tête de la galerie : nom du client, signature, actions */}
      <header className="sticky top-0 z-30 bg-bg border-b border-line">
        <div className="mx-auto max-w-[1700px] px-5 sm:px-8 lg:px-12 pt-[max(env(safe-area-inset-top),0.9rem)] md:pt-0 flex flex-wrap md:flex-nowrap items-center gap-x-3 md:gap-x-8 md:h-20">
          <button className="flex-1 md:flex-none min-w-0 md:max-w-[32%] text-left pb-3 md:pb-0" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Revenir à la couverture">
            <p className="gallery-title text-xl sm:text-2xl truncate">{props.title}</p>
            <p className="eyebrow text-muted text-[9px] mt-1">ALVZ.REC{props.date ? ` · ${props.date}` : ""}</p>
          </button>
          {(props.collections.length + (props.videos.length ? 1 : 0) > 1 || tab === FAVORITES_TAB || tab === FACES_TAB) && (
            <nav ref={navRef} className="relative order-last md:order-2 w-[calc(100%+2.5rem)] sm:w-full md:w-auto md:flex-1 min-w-0 flex md:justify-center gap-6 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0 md:h-full md:items-center border-t border-line md:border-0">
              {indicator && (
                <span
                  aria-hidden
                  className="absolute bottom-0 md:bottom-5 h-px bg-ink transition-[left,width] duration-500 ease-[cubic-bezier(0.22,0.8,0.2,1)]"
                  style={{ left: indicator.left, width: indicator.width }}
                />
              )}
              {props.collections.map((c) => (
                <button
                  key={c.id}
                  data-tab={c.id}
                  onClick={() => selectTab(c.id)}
                  className={`eyebrow whitespace-nowrap py-3 transition-colors duration-300 ${tab === c.id ? "text-ink" : "text-muted hover:text-ink"}`}
                >
                  {c.name}
                </button>
              ))}
              {props.videos.length > 0 && (
                <button
                  data-tab={VIDEOS_TAB}
                  onClick={() => selectTab(VIDEOS_TAB)}
                  className={`eyebrow whitespace-nowrap py-3 transition-colors duration-300 ${tab === VIDEOS_TAB ? "text-ink" : "text-muted hover:text-ink"}`}
                >
                  Vidéos
                </button>
              )}
              {tab === FACES_TAB && (
                <button data-tab={FACES_TAB} className="eyebrow whitespace-nowrap py-3 text-ink flex items-center gap-1.5">
                  <FaceScanIcon className="w-3.5 h-3.5" /> Mes photos
                </button>
              )}
              {tab === FAVORITES_TAB && (
                <button data-tab={FAVORITES_TAB} className="eyebrow whitespace-nowrap py-3 text-ink flex items-center gap-1.5">
                  <HeartIcon className="w-3.5 h-3.5" filled /> Ma sélection
                </button>
              )}
            </nav>
          )}
          <div className="flex items-center -mr-2 pb-3 md:pb-0 md:order-3 ml-auto">
            {canContact && (
              <button
                onClick={() => setContactOpen(true)}
                className="flex items-center h-10 px-2 text-ink/80 hover:text-ink transition-colors"
                aria-label="Contacter"
                title="Contacter"
              >
                <ChatIcon className="w-[21px] h-[21px]" />
              </button>
            )}
            {props.favoritesEnabled && (
              <button
                onClick={() => selectTab(tab === FAVORITES_TAB ? props.collections[0]?.id ?? "" : FAVORITES_TAB)}
                className={`relative flex items-center gap-1.5 h-10 px-2 transition-colors ${tab === FAVORITES_TAB ? "text-heart" : "text-ink/80 hover:text-ink"}`}
                aria-label="Ma sélection"
                title="Ma sélection"
              >
                <span className="relative">
                  <HeartIcon className="w-[22px] h-[22px]" filled={tab === FAVORITES_TAB} />
                  {favorites.size > 0 && (
                    <span key={favorites.size} className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-heart text-white text-[9px] leading-4 text-center animate-[heartPop_0.45s_ease-out]">
                      {favorites.size}
                    </span>
                  )}
                </span>
              </button>
            )}
            {(zipAllowed || props.favoritesEnabled) && (
              <div className="relative">
                <button
                  className="flex items-center gap-1.5 h-10 px-2 text-ink/80 hover:text-ink transition-colors"
                  onClick={() => setMenu((m) => !m)}
                  aria-label={zipAllowed ? "Télécharger" : "Menu"}
                  title={zipAllowed ? "Télécharger" : "Menu"}
                  disabled={zip !== null}
                >
                  {/* En-tête : icônes seules, sur téléphone comme sur ordinateur (demandé le 31 oct.). */}
                  {zipAllowed ? <DownloadIcon className="w-5 h-5" /> : <DotsVertical />}
                </button>
                {menu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                    <div className="absolute right-0 mt-2 z-20 w-64 bg-bg border border-line shadow-xl py-2 animate-[fadeUp_0.2s_ease-out_both]">
                      {props.favoritesEnabled && (
                        <button
                          className="w-full text-left px-5 py-3 text-sm hover:bg-bg-soft flex items-center gap-3"
                          onClick={() => {
                            setMenu(false);
                            selectTab(FAVORITES_TAB);
                          }}
                        >
                          <HeartIcon className="w-4 h-4" /> Ma sélection{favorites.size > 0 ? ` (${favorites.size})` : ""}
                        </button>
                      )}
                      {zipAllowed && (
                        <>
                          {activeCollection && props.collections.length > 1 && (
                            <button className="w-full text-left px-5 py-3 text-sm hover:bg-bg-soft flex items-center gap-3" onClick={() => startZip(activeCollection.id)}>
                              <DownloadIcon className="w-4 h-4" /> Télécharger « {activeCollection.name} »
                            </button>
                          )}
                          <button className="w-full text-left px-5 py-3 text-sm hover:bg-bg-soft flex items-center gap-3" onClick={() => startZip(null)}>
                            <DownloadIcon className="w-4 h-4" /> Télécharger toute la galerie
                          </button>
                          <p className="px-5 pt-2 pb-1 text-[11px] text-muted leading-snug">Photos en haute définition, au format ZIP.</p>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1700px] px-2 sm:px-8 lg:px-12 pt-2 sm:pt-8 lg:pt-10 pb-24 protect">
        {props.paymentPending && (
          <p className="text-center text-xs text-muted pt-4 pb-6">Le téléchargement sera disponible dès le règlement de la prestation.</p>
        )}
        {/* Recherche par selfie : grand bouton avec son texte, sous l'en-tête. */}
        {props.faceSearch && tab !== FACES_TAB && tab !== VIDEOS_TAB && (
          <div className="px-3 sm:px-0 pt-4 pb-6 sm:pt-0 sm:pb-8">
            <button
              onClick={() => (faceMatches ? selectTab(FACES_TAB) : setFaceOpen(true))}
              className="w-full max-w-xl mx-auto flex items-center justify-center gap-3 h-14 border border-line hover:border-ink text-ink transition-colors"
            >
              <FaceScanIcon className="w-5 h-5" />
              <span className="eyebrow text-[11px]">{faceMatches ? `Mes photos (${faceMatches.length})` : "Trouver mes photos"}</span>
              <span className="text-[11px] text-muted hidden sm:inline">{faceMatches ? "" : "avec un selfie"}</span>
            </button>
          </div>
        )}
        {tab === FAVORITES_TAB && favorites.size > 0 && (
          <p className="text-center text-xs text-muted py-6">
            Sélection enregistrée pour {email}. Elle est automatiquement transmise à ALVZ.REC.
          </p>
        )}
        {tab === FACES_TAB && (
          <div className="text-center py-6 px-6">
            <p className="text-sm">
              {visible.length
                ? `${visible.length} photo${visible.length > 1 ? "s" : ""} où vous apparaissez`
                : "Aucune photo trouvée avec ce selfie."}
            </p>
            <p className="text-xs text-muted mt-2">
              La recherche peut manquer une photo floue, de profil ou très sombre : n&apos;hésitez pas à parcourir toute la galerie.
            </p>
            <button className="text-xs underline underline-offset-4 mt-3 hover:opacity-70" onClick={() => setFaceOpen(true)}>
              Nouvelle recherche
            </button>
            {faceDebug && (
              <p className="text-[11px] text-muted mt-3 font-mono">
                Studio · seuil {faceDebug.threshold} · photos les plus proches :{" "}
                {faceDebug.distances.length ? faceDebug.distances.map((d) => d.toFixed(2)).join(" ") : "aucune sous 0,85"}
              </p>
            )}
          </div>
        )}
        {tab === VIDEOS_TAB ? (
          <div key={tab} className="animate-[gridIn_0.6s_ease-out_both] px-3 sm:px-0 pt-4">
            <VideoCards slug={props.slug} videos={props.videos} />
          </div>
        ) : visible.length === 0 ? (
          tab === FACES_TAB ? null : tab === FAVORITES_TAB ? (
            <div className="py-28 text-center px-8">
              <HeartIcon className="w-6 h-6 mx-auto text-muted" />
              <p className="gallery-title text-2xl mt-5">Votre sélection est vide</p>
              <p className="text-sm text-muted mt-3">Touchez ♡ sur vos photos préférées pour les retrouver ici.</p>
            </div>
          ) : (
            <p className="py-32 text-center gallery-title text-2xl text-muted">Aucune photo ici pour l&apos;instant.</p>
          )
        ) : (
          <div key={tab} className="animate-[gridIn_0.6s_ease-out_both]">
          <PhotoGrid
            photos={visible}
            style={design.grid_style}
            size={design.grid_size}
            spacing={design.grid_spacing}
            favorites={favorites}
            favoritesEnabled={props.favoritesEnabled}
            onOpen={(id) => setOpen(visible.findIndex((p) => p.id === id))}
            onToggleFavorite={toggleFavorite}
          />
          </div>
        )}
      </main>

      {design.show_contact && props.contact ? (
        <ContactCard contact={props.contact} />
      ) : (
        <footer className="pb-12 text-center">
          <Wordmark height={44} className="opacity-80" />
        </footer>
      )}

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
          onDownload={(e, href) => {
            if (!needEmail) return;
            e.preventDefault();
            setAskDownload(() => () => {
              const a = document.createElement("a");
              a.href = href;
              a.download = "";
              a.click();
            });
          }}
        />
      )}

      {askDownload && (
        <EmailDialog
          slug={props.slug}
          purpose="download"
          onCancel={() => setAskDownload(null)}
          onDone={(savedEmail, ids) => {
            setEmail(savedEmail);
            setFavorites(new Set(ids));
            const go = askDownload;
            setAskDownload(null);
            go();
          }}
        />
      )}

      {faceOpen && (
        <FaceSearchDialog
          slug={props.slug}
          onCancel={() => setFaceOpen(false)}
          onDone={(ids, debug) => {
            setFaceMatches(ids);
            setFaceDebug(debug ?? null);
            setFaceOpen(false);
            selectTab(FACES_TAB);
          }}
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

      {contactOpen && props.contact && <ContactSheet contact={props.contact} onClose={() => setContactOpen(false)} />}

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
  coverAlt,
  title,
  date,
  onEnter,
}: {
  design: GalleryDesign;
  cover: Props["cover"];
  coverAlt: string | null;
  title: string;
  date: string;
  onEnter: () => void;
}) {
  const focus = { objectPosition: `${design.cover_focus_x}% ${design.cover_focus_y}%` };
  const sectionRef = useRef<HTMLElement>(null);


  const img = (cls: string, src: string | null | undefined = cover?.src, parallax = true) =>
    src ? (
      <div className={`${cls} overflow-hidden bg-bg-soft`}>
        <div className={`w-full h-full ${parallax ? "cover-parallax" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover animate-[coverIn_1.6s_ease-out_both,kenBurns_14s_cubic-bezier(0.2,0.6,0.2,1)_both]"
            style={focus}
          />
        </div>
      </div>
    ) : (
      <div className={`${cls} bg-bg-soft`} />
    );
  const words = title.split(/\s+/).filter(Boolean);
  const enter = (light: boolean, delay = 0.9) => (
    <button
      onClick={onEnter}
      className={`mt-10 inline-block border px-8 sm:px-10 py-4 eyebrow tracking-[0.3em] transition-colors duration-300 animate-[fadeUp_1.6s_ease-out_both] ${light ? "border-white/85 text-white hover:bg-white hover:text-black" : "border-ink/70 text-ink hover:bg-ink hover:text-bg"}`}
      style={{ animationDelay: `${delay + words.length * 0.14}s` }}
    >
      Afficher la galerie
    </button>
  );
  const heading = (cls: string, withDate = true) => (
    <>
      <h1 className={`gallery-title break-words ${cls}`} aria-label={title}>
        {words.map((w, i) => (
          <span key={i} aria-hidden className="inline-block animate-[wordIn_1.1s_cubic-bezier(0.22,0.8,0.2,1)_both]" style={{ animationDelay: `${0.35 + i * 0.14}s` }}>
            {w}
            {i < words.length - 1 ? "\u00a0" : ""}
          </span>
        ))}
      </h1>
      {withDate && date && (
        <p className="eyebrow mt-5 opacity-80 animate-[fadeUp_1.4s_ease-out_both]" style={{ animationDelay: `${0.5 + words.length * 0.14}s` }}>
          {date}
        </p>
      )}
    </>
  );
  const topLogo = (light: boolean) => (
    <div className={`absolute top-0 inset-x-0 z-10 flex justify-center pt-[max(env(safe-area-inset-top),1.75rem)] ${light ? "text-white/90" : ""}`}>
      <Wordmark height={44} tone={light ? "white" : "auto"} />
    </div>
  );
  const big = "text-[clamp(2.4rem,8.5vw,7rem)]";
  const medium = "text-[clamp(2rem,5.5vw,4.5rem)]";

  switch (design.cover_layout) {
    case "split":
      return (
        <section ref={sectionRef} className="min-h-svh flex flex-col-reverse md:flex-row protect">
          <div className="md:w-[42%] flex flex-col items-center justify-center text-center px-8 py-14 md:py-0">
            <Wordmark height={48} className="mb-12" />
            {heading(medium)}
            {enter(false)}
          </div>
          <div className="relative h-[62svh] md:h-auto md:flex-1">{img("absolute inset-0 w-full h-full")}</div>
        </section>
      );

    case "framed":
      return (
        <section ref={sectionRef} className="min-h-svh flex flex-col items-center px-5 sm:px-12 pt-[max(env(safe-area-inset-top),1.5rem)] pb-10 protect">
          <Wordmark height={40} className="mb-6" />
          <div className="relative w-full flex-1 min-h-[55svh]">{img("absolute inset-0 w-full h-full")}</div>
          <div className="text-center pt-10">
            {heading(medium)}
            {enter(false)}
          </div>
        </section>
      );

    case "journal":
      return (
        <section ref={sectionRef} className="relative min-h-svh protect px-5 sm:px-12 pt-[max(env(safe-area-inset-top),1.5rem)] pb-10 flex flex-col">
          <Wordmark height={40} className="self-center mb-6" />
          <div className="relative w-full sm:w-[62%] h-[52svh] sm:h-[68svh]">{img("absolute inset-0 w-full h-full")}</div>
          <div className="mt-8 sm:mt-0 sm:absolute sm:right-12 sm:bottom-16 text-left sm:text-right sm:max-w-[34%]">
            {heading(medium)}
            {enter(false)}
          </div>
        </section>
      );

    case "stamp":
      return (
        <section ref={sectionRef} className="min-h-svh flex flex-col items-center justify-center text-center px-6 py-16 protect">
          <Wordmark height={40} className="mb-12" />
          <div className="relative w-[62vw] max-w-[380px] aspect-[4/5]">{img("absolute inset-0 w-full h-full", cover?.src, false)}</div>
          <div className="mt-10">
            {heading(medium)}
            {enter(false)}
          </div>
        </section>
      );

    case "classic":
      return (
        <section ref={sectionRef} className="protect">
          <div className="relative h-[82svh] w-full">
            {img("absolute inset-0 w-full h-full")}
            <div className="absolute top-0 inset-x-0 flex justify-center pt-[max(env(safe-area-inset-top),1.5rem)]">
              <Wordmark height={40} tone="white" />
            </div>
          </div>
          <div className="mx-auto max-w-[1800px] px-5 sm:px-8 py-6 flex items-end justify-between gap-6">
            <div>{heading("text-[clamp(1.6rem,4vw,2.8rem)]", false)}</div>
            {date && <p className="eyebrow text-muted shrink-0 pb-1">{date}</p>}
          </div>
        </section>
      );

    case "none":
      return (
        <section ref={sectionRef} className="pt-[max(env(safe-area-inset-top),2rem)] pb-14 px-6 text-center protect">
          <Wordmark height={40} className="mb-14" />
          {heading(medium)}
        </section>
      );

    case "divider":
      return (
        <section ref={sectionRef} className="relative h-svh w-full overflow-hidden bg-black protect">
          <div className="absolute inset-0 flex gap-[3px]">
            {img("relative flex-1 h-full")}
            {img("relative flex-1 h-full", coverAlt ?? cover?.src)}
          </div>
          <div className="absolute inset-0 bg-black/30" />
          {topLogo(true)}
          <div className="cover-fade absolute inset-0 flex flex-col items-center justify-center text-center text-white px-6">
            {heading(big)}
            {enter(true)}
          </div>
        </section>
      );

    default: {
      // Mises en page plein écran : centre, bas gauche, cadre fin, lignes, contour
      const layout = design.cover_layout;
      const bottom = layout === "bottom";
      return (
        <section ref={sectionRef} className="relative h-svh w-full overflow-hidden bg-black protect">
          {img("absolute inset-0 w-full h-full")}
          <div className={`absolute inset-0 ${bottom ? "bg-gradient-to-b from-black/20 via-transparent to-black/70" : "bg-black/30"}`} />
          {layout === "frame" && <div className="absolute inset-4 sm:inset-8 border border-white/80 pointer-events-none" />}
          {layout === "center" ? (
            <div className="absolute bottom-0 inset-x-0 z-10 flex justify-center pb-[max(env(safe-area-inset-bottom),2.25rem)] animate-[fadeIn_1.6s_1.2s_ease-out_both]">
              <Wordmark height={40} tone="white" />
            </div>
          ) : (
            topLogo(true)
          )}
          <div
            className={`cover-fade absolute text-white px-6 sm:px-14 ${bottom ? "inset-x-0 bottom-0 pb-[max(env(safe-area-inset-bottom),3rem)] sm:pb-20 text-left" : "inset-0 flex flex-col items-center justify-center text-center"}`}
          >
            {layout === "stripe" ? (
              <div className="w-full max-w-4xl">
                <span className="block h-px bg-white/80 mb-8 origin-left animate-[lineIn_1.2s_0.2s_ease-out_both]" />
                {heading(big)}
                <span className="block h-px bg-white/80 mt-8 origin-right animate-[lineIn_1.2s_0.2s_ease-out_both]" />
                {enter(true)}
              </div>
            ) : layout === "outline" ? (
              <div className="border border-white/85 px-8 sm:px-16 py-14 sm:py-20 max-w-3xl animate-[fadeIn_1.2s_ease-out_both]">
                {heading(medium)}
                {enter(true, 0.6)}
              </div>
            ) : (
              <>
                {heading(big)}
                {enter(true)}
              </>
            )}
          </div>
        </section>
      );
    }
  }
}

export function EmailDialog({
  slug,
  purpose = "favorites",
  onCancel,
  onDone,
}: {
  slug: string;
  purpose?: "favorites" | "download";
  onCancel: () => void;
  onDone: (email: string, ids: string[]) => void;
}) {
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
        {purpose === "download" ? <DownloadIcon className="w-5 h-5 mx-auto" /> : <HeartIcon className="w-5 h-5 mx-auto text-heart" filled />}
        <h2 className="display text-3xl text-center mt-5">{purpose === "download" ? "Téléchargement" : "Vos favoris"}</h2>
        <p className="text-sm text-muted text-center mt-3 leading-relaxed">
          {purpose === "download"
            ? "Indiquez votre e-mail pour télécharger vos photos. Il ne vous sera demandé qu'une fois."
            : "Indiquez votre e-mail pour enregistrer votre sélection et la retrouver plus tard."}
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

function DotsVertical() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}

function ChatIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4.5 18.5 5.7 15A7.5 7.5 0 1 1 9 18.3l-4.5.2Z" />
    </svg>
  );
}

function FaceScanIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 8V5.5a2 2 0 0 1 2-2H8M16 3.5h2.5a2 2 0 0 1 2 2V8M20.5 16v2.5a2 2 0 0 1-2 2H16M8 20.5H5.5a2 2 0 0 1-2-2V16" />
      <circle cx="12" cy="10.5" r="3" />
      <path d="M7.5 17.2a5 5 0 0 1 9 0" />
    </svg>
  );
}

/**
 * « Trouver mes photos » : le client accepte, prend un selfie (ou choisit une photo) ; l'empreinte du visage
 * est calculée sur son téléphone et seule elle part au site. Le selfie n'est ni envoyé ni enregistré.
 */
function FaceSearchDialog({
  slug,
  onCancel,
  onDone,
}: {
  slug: string;
  onCancel: () => void;
  onDone: (photoIds: string[], debug?: { distances: number[]; threshold: number }) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);

  async function search(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setStep("Préparation de la reconnaissance…");
      const { loadFaceApi, selfieDescriptor } = await import("@/lib/client/faces");
      await loadFaceApi();
      setStep("Analyse de votre selfie…");
      const descriptor = await selfieDescriptor(file);
      if (!descriptor) throw new Error("Aucun visage trouvé. Reprenez un selfie de face, bien éclairé, sans lunettes de soleil.");
      setStep("Recherche dans la galerie…");
      const res = await fetch(`/api/g/${slug}/faces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriptor }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Recherche impossible");
      onDone(json.photoIds ?? [], json.distances ? { distances: json.distances, threshold: json.threshold } : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={step ? undefined : onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-bg text-ink px-7 pt-10 pb-[max(env(safe-area-inset-bottom),2rem)] sm:p-12 animate-[fadeUp_0.4s_ease-out_both]"
      >
        <FaceScanIcon className="w-6 h-6 mx-auto" />
        <h2 className="display text-3xl text-center mt-5">Trouver mes photos</h2>
        <p className="text-sm text-muted text-center mt-3 leading-relaxed">
          Prenez un selfie : nous affichons toutes les photos de la galerie où vous apparaissez.
        </p>
        <label className="flex items-start gap-3 mt-7 text-xs text-muted leading-relaxed cursor-pointer">
          <input type="checkbox" className="mt-0.5 accent-current" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={Boolean(step)} />
          <span>
            J&apos;accepte que mon visage soit comparé aux photos de cette galerie. Le selfie reste sur mon appareil : il n&apos;est ni envoyé
            ni enregistré.
          </span>
        </label>
        <input ref={camera} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => search(e.target.files?.[0])} />
        <input ref={library} type="file" accept="image/*" className="hidden" onChange={(e) => search(e.target.files?.[0])} />
        {step ? (
          <p className="text-sm text-center mt-8 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {step}
          </p>
        ) : (
          <div className="mt-8 space-y-3">
            <button className="btn w-full" disabled={!consent} onClick={() => camera.current?.click()}>
              Prendre un selfie
            </button>
            <button className="btn btn-ghost w-full" disabled={!consent} onClick={() => library.current?.click()}>
              Choisir une photo de moi
            </button>
            <button className="w-full text-xs text-muted pt-2 hover:text-ink" onClick={onCancel}>
              Annuler
            </button>
          </div>
        )}
        {error && <p className="text-sm text-danger mt-4 text-center">{error}</p>}
      </div>
    </div>
  );
}
