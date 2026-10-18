"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GalleryDesign } from "@/lib/design";
import type { Collection, PhotoView } from "@/lib/types";
import { formatLongDate } from "@/lib/dates";
import { ArrowLeft, BrushIcon, ChevronDown, CloseIcon, DotsIcon, FilmIcon, GearIcon, HeartIcon, ImageIcon, MenuIcon, PencilIcon } from "@/components/icons";
import { VideosPanel, type AdminVideo } from "./videos-panel";
import { CollectionsSidebar } from "./collections-sidebar";
import { PhotosPanel } from "./photos-panel";
import { DesignPanel } from "./design-panel";
import { SettingsPanel } from "./settings-panel";
import { FavoritesPanel } from "./favorites-panel";
import { DownloadsPanel, type DownloadRow } from "./downloads-panel";
import { trashGallery } from "@/app/admin/actions";
import { deleteInBackground, useHidden } from "./background";
import { openGalleryBoard } from "@/app/admin/board-actions";

export type ManagedGallery = {
  id: string;
  slug: string;
  title: string;
  eventDate: string;
  expiresAt: string;
  expired: boolean;
  coverPhotoId: string | null;
  hasPassword: boolean;
  watermark: boolean;
  downloadsEnabled: boolean;
  downloadWebEnabled: boolean;
  downloadEmailRequired: boolean;
  favoritesEnabled: boolean;
  design: GalleryDesign;
  kind: "photo" | "video";
};

type Props = {
  gallery: ManagedGallery;
  collections: Collection[];
  photos: PhotoView[];
  positions: Record<string, number>;
  favoriteLists: { id: string; email: string; photoIds: string[] }[];
  downloads: DownloadRow[];
  videos: AdminVideo[];
};

const TABS = [
  { id: "photos", label: "Photos", Icon: ImageIcon },
  { id: "videos", label: "Vidéos", Icon: FilmIcon },
  { id: "design", label: "Design", Icon: BrushIcon },
  { id: "settings", label: "Paramètres", Icon: GearIcon },
  { id: "activity", label: "Activité", Icon: HeartIcon },
] as const;

export function GalleryManager(raw: Props) {
  // Photos, collections et vidéos en cours de suppression : déjà masquées.
  const hiddenIds = useHidden();
  const props: Props = {
    ...raw,
    collections: raw.collections.filter((c) => !hiddenIds.has(c.id)),
    photos: raw.photos.filter((p) => !hiddenIds.has(p.id) && !hiddenIds.has(p.collectionId)),
    videos: raw.videos.filter((v) => !hiddenIds.has(v.id)),
  };
  const { gallery } = props;
  const router = useRouter();
  const isVideo = gallery.kind === "video";
  // Projet vidéo : vidéos, design, paramètres. Galerie photo : photos, design, paramètres, activité.
  const tabs = TABS.filter((t) => (isVideo ? ["videos", "design", "settings"].includes(t.id) : t.id !== "videos"));
  const home = isVideo ? "/admin/videos" : "/admin";
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>(isVideo ? "videos" : "photos");
  const [menu, setMenu] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [activityTab, setActivityTab] = useState<"favorites" | "downloads">("favorites");
  const [activeCollection, setActiveCollection] = useState(props.collections[0]?.id ?? "");
  const [plus, setPlus] = useState(false);
  const collectionCounts = props.photos.reduce<Record<string, number>>((acc, p) => {
    acc[p.collectionId] = (acc[p.collectionId] ?? 0) + 1;
    return acc;
  }, {});
  const coverPhoto = props.photos.find((p) => p.id === gallery.coverPhotoId) ?? props.photos[0];
  const cover = coverPhoto ? { src: coverPhoto.web } : props.videos[0] ? { src: props.videos[0].poster } : null;
  const filled = (isVideo ? props.videos.length : props.photos.length) > 0;
  const downloadCounts = props.downloads.reduce<Record<string, number>>((acc, d) => {
    if (d.kind === "photo" && d.photo_id) acc[d.photo_id] = (acc[d.photo_id] ?? 0) + 1;
    return acc;
  }, {});
  // Qui a téléchargé chaque photo (seule ou dans un ZIP) : visiteurs qui ont donné leur e-mail.
  const downloadEmails: Record<string, string[]> = {};
  for (const d of props.downloads) {
    if (!d.email) continue;
    const ids =
      d.kind === "photo"
        ? d.photo_id
          ? [d.photo_id]
          : []
        : props.photos.filter((p) => !d.collection_id || p.collectionId === d.collection_id).map((p) => p.id);
    for (const id of ids) {
      const list = (downloadEmails[id] ??= []);
      if (!list.includes(d.email)) list.push(d.email);
    }
  }
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}/g/${gallery.slug}`);
    setMenu(false);
    setPlus(false);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /** Moodboard / préparation du shooting ou du tournage (créé au premier clic). */
  function openBoard() {
    setMenu(false);
    setPlus(false);
    void openGalleryBoard(gallery.id);
  }

  async function remove() {
    setMenu(false);
    setPlus(false);
    if (!confirm(`Mettre « ${gallery.title} » à la corbeille ? Vous pourrez la restaurer pendant 30 jours.`)) return;
    // Retour immédiat à la liste (la galerie n'y apparaît plus) ; la mise à la corbeille se fait en arrière-plan.
    deleteInBackground([gallery.id], () => trashGallery(gallery.id), () => router.refresh());
    router.replace(home);
  }

  const status = gallery.expired ? "bg-danger" : filled ? "bg-emerald-500" : "bg-muted";
  const statusLabel = gallery.expired ? "Expirée" : filled ? "En ligne" : "Vide";
  const activityItems = [
    ["favorites", "Favoris", props.favoriteLists.length],
    ["downloads", "Téléchargements", props.downloads.length],
  ] as const;

  return (
    <div className={`lg:h-svh lg:flex lg:flex-col ${deleting ? "opacity-40 pointer-events-none" : ""}`}>
      {/* Ordinateur : barre du haut (retour, nom, statut, aperçu, partage) */}
      <div className="hidden lg:flex items-center gap-4 h-[72px] shrink-0 px-5 border-b border-line">
        <Link href={home} className="icon-btn" aria-label="Retour">
          <ArrowLeft />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg truncate leading-tight">{gallery.title}</h1>
          <button onClick={() => setTab("settings")} className="text-[13px] text-muted hover:text-ink">
            {formatLongDate(gallery.eventDate || null) || "Ajouter une date d'événement"}
          </button>
        </div>
        <span className={`ml-2 shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold tracking-widest uppercase ${gallery.expired ? "bg-danger/15 text-danger" : filled ? "bg-emerald-500/15 text-emerald-600" : "bg-bg-soft text-muted"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status}`} /> {statusLabel}
        </span>
        <div className="flex-1" />
        {copied && <span className="text-xs text-accent">Lien copié ✓</span>}
        <div className="relative">
          <button onClick={() => setPlus((o) => !o)} className="flex items-center gap-1 px-3 h-10 text-sm text-muted hover:text-ink">
            Plus <ChevronDown className="w-4 h-4" />
          </button>
          {plus && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPlus(false)} />
              <div className="absolute right-0 mt-1 z-20 w-56 bg-bg-soft border border-line py-1 shadow-xl text-sm">
                <button className="block w-full text-left px-4 py-3 hover:bg-bg" onClick={copy}>Copier le lien client</button>
                <button className="block w-full text-left px-4 py-3 hover:bg-bg" onClick={() => { setTab("settings"); setPlus(false); }}>Paramètres de la galerie</button>
                <button className="block w-full text-left px-4 py-3 hover:bg-bg" onClick={openBoard}>Tableau de préparation</button>
                <button className="block w-full text-left px-4 py-3 text-danger hover:bg-bg" onClick={remove}>Supprimer la galerie</button>
              </div>
            </>
          )}
        </div>
        <a href={`/g/${gallery.slug}`} target="_blank" rel="noreferrer" className="px-3 h-10 flex items-center text-sm text-muted hover:text-ink">
          Aperçu
        </a>
        <button onClick={copy} className="btn">Partager</button>
      </div>

      {/* Mobile : en-tête */}
      <div className="lg:hidden">
      <div className="flex items-center gap-2 -mx-2">
        <Link href={home} className="icon-btn" aria-label="Retour">
          <ArrowLeft />
        </Link>
        <span className={`w-2 h-2 rounded-full shrink-0 ${status}`} />
        <h1 className="flex-1 min-w-0 text-lg truncate ml-1">{gallery.title}</h1>
        <div className="relative">
          <button className="icon-btn" onClick={() => setMenu((m) => !m)} aria-label="Options">
            <DotsIcon />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 mt-1 z-20 w-56 bg-bg-soft border border-line py-1 shadow-xl text-sm">
                <button className="block w-full text-left px-4 py-3 hover:bg-bg" onClick={copy}>Copier le lien client</button>
                <a className="block px-4 py-3 hover:bg-bg" href={`/g/${gallery.slug}`} target="_blank" rel="noreferrer" onClick={() => setMenu(false)}>Voir la galerie</a>
                <button className="block w-full text-left px-4 py-3 hover:bg-bg" onClick={openBoard}>Tableau de préparation</button>
                <button className="block w-full text-left px-4 py-3 text-danger hover:bg-bg" onClick={remove}>Supprimer la galerie</button>
              </div>
            </>
          )}
        </div>
        <button className="icon-btn" onClick={() => setTab("design")} aria-label="Design">
          <PencilIcon />
        </button>
        <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="Menu de la galerie">
          <MenuIcon />
        </button>
      </div>
      {copied && <p className="text-xs text-accent mt-1">Lien copié ✓</p>}

      <p className="text-xs text-muted mt-2">
        {isVideo
          ? `${props.videos.length} vidéo${props.videos.length > 1 ? "s" : ""}`
          : `${props.photos.length} photos · ${props.collections.length} collection${props.collections.length > 1 ? "s" : ""}`}
      </p>

      {/* Menu latéral : sections de la galerie */}
      {drawer && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 animate-[fadeIn_0.2s_ease-out_both]" onClick={() => setDrawer(false)} />
          <aside className="absolute right-0 top-0 h-full w-[78%] max-w-xs bg-bg border-l border-line px-6 pt-[max(env(safe-area-inset-top),1rem)] animate-[slideIn_0.25s_ease-out_both]">
            <div className="flex items-center justify-between h-12">
              <span className="eyebrow text-muted">{isVideo ? "Projet vidéo" : "Galerie"}</span>
              <button className="icon-btn -mr-2" onClick={() => setDrawer(false)} aria-label="Fermer">
                <CloseIcon />
              </button>
            </div>
            <nav className="mt-6">
              {tabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => {
                    setTab(id);
                    setDrawer(false);
                  }}
                  className={`w-full flex items-center gap-4 py-4 border-b border-line text-left ${tab === id ? "text-ink" : "text-muted hover:text-ink"}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1 text-[15px]">{label}</span>
                  {id === "activity" && props.favoriteLists.length > 0 && <span className="text-xs">{props.favoriteLists.length}</span>}
                  {tab === id && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {tab !== (isVideo ? "videos" : "photos") && (
        <button onClick={() => setTab(isVideo ? "videos" : "photos")} className="mt-6 eyebrow text-muted hover:text-ink">
          ← {isVideo ? "Vidéos" : "Photos"}
        </button>
      )}
      </div>

      <div className="lg:flex lg:flex-1 lg:min-h-0">
      {/* Ordinateur : colonne de gauche (couverture, onglets, collections) */}
      <aside className="hidden lg:block w-80 shrink-0 border-r border-line overflow-y-auto">
        <button onClick={() => setTab("design")} className="block w-full aspect-[16/10] bg-bg-soft overflow-hidden" title="Modifier la couverture">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.src} alt="" className="w-full h-full object-cover" style={{ objectPosition: `${gallery.design.cover_focus_x}% ${gallery.design.cover_focus_y}%` }} />
          ) : (
            <span className="eyebrow text-muted">Aucune couverture</span>
          )}
        </button>
        <div className="grid border-b border-line" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              title={label}
              aria-label={label}
              className={`h-14 flex items-center justify-center border-b-2 -mb-px transition-colors ${tab === id ? "border-emerald-500 text-ink" : "border-transparent text-muted hover:text-ink"}`}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </div>
        {tab === "photos" && (
          <CollectionsSidebar
            galleryId={gallery.id}
            collections={props.collections}
            counts={collectionCounts}
            activeId={activeCollection}
            onActive={setActiveCollection}
          />
        )}
        {tab === "activity" && (
          <div>
            <p className="eyebrow text-muted px-6 h-14 flex items-center">Activité</p>
            {activityItems.map(([k, label, n]) => (
              <button
                key={k}
                onClick={() => setActivityTab(k)}
                className={`w-full flex items-center justify-between px-6 h-14 text-[15px] transition-colors ${activityTab === k ? "bg-bg-soft text-ink" : "text-muted hover:text-ink"}`}
              >
                {label} <span className="text-sm text-muted">{n}</span>
              </button>
            ))}
          </div>
        )}
        {tab === "videos" && (
          <div className="px-6 py-5">
            <p className="eyebrow text-muted">Vidéos</p>
            <p className="text-sm text-muted mt-3 leading-relaxed">
              {props.videos.length} vidéo{props.videos.length > 1 ? "s" : ""}. Chaque clip a son propre lien : le client arrive
              directement sur le lecteur, peut commenter sur la timeline et télécharger si vous l&apos;autorisez.
            </p>
          </div>
        )}
        {(tab === "design" || tab === "settings") && (
          <div className="px-6 py-5">
            <p className="eyebrow text-muted">{tab === "design" ? "Design" : "Paramètres"}</p>
            <p className="text-sm text-muted mt-3 leading-relaxed">
              {tab === "design"
                ? "Couverture, typographie, couleurs et grille de la galerie que voient vos clients."
                : "Nom, date, lien, mot de passe, expiration, téléchargements, favoris et filigrane."}
            </p>
          </div>
        )}
      </aside>

      <div className="pt-6 lg:pt-8 lg:flex-1 lg:overflow-y-auto lg:px-10 lg:pb-16">
      <div className={tab === "photos" || tab === "videos" ? "" : "lg:max-w-2xl"}>
        {tab === "photos" && (
          <PhotosPanel
            activeId={activeCollection}
            onActive={setActiveCollection}
            galleryId={gallery.id}
            coverPhotoId={gallery.coverPhotoId}
            collections={props.collections}
            photos={props.photos}
            positions={props.positions}
            downloadCounts={downloadCounts}
            downloadEmails={downloadEmails}
            favoriteCounts={props.favoriteLists.reduce<Record<string, number>>((acc, l) => {
              l.photoIds.forEach((id) => (acc[id] = (acc[id] ?? 0) + 1));
              return acc;
            }, {})}
          />
        )}
        {tab === "videos" && <VideosPanel galleryId={gallery.id} slug={gallery.slug} watermark={gallery.watermark} videos={props.videos} />}
        {tab === "design" && <DesignPanel gallery={gallery} photos={props.photos} />}
        {tab === "settings" && <SettingsPanel gallery={gallery} onDelete={remove} />}
        {tab === "activity" && (
          <div>
            <div className="flex border border-line mb-10 lg:hidden">
              {([
                ["favorites", `Favoris (${props.favoriteLists.length})`],
                ["downloads", `Téléchargements (${props.downloads.length})`],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setActivityTab(k)}
                  className={`flex-1 py-3 text-[11px] tracking-wider uppercase transition-colors ${activityTab === k ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {activityTab === "favorites" ? (
              <FavoritesPanel lists={props.favoriteLists} photos={props.photos} collections={props.collections} />
            ) : (
              <DownloadsPanel downloads={props.downloads} photos={props.photos} collections={props.collections} />
            )}
          </div>
        )}
      </div>
      </div>
      </div>
    </div>
  );
}
