"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GalleryDesign } from "@/lib/design";
import type { Collection, PhotoView } from "@/lib/types";
import { ArrowLeft, BrushIcon, CloseIcon, DotsIcon, GearIcon, HeartIcon, ImageIcon, MenuIcon, PencilIcon } from "@/components/icons";
import { PhotosPanel } from "./photos-panel";
import { DesignPanel } from "./design-panel";
import { SettingsPanel } from "./settings-panel";
import { FavoritesPanel } from "./favorites-panel";
import { DownloadsPanel, type DownloadRow } from "./downloads-panel";
import { purge } from "./purge";

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
  favoritesEnabled: boolean;
  design: GalleryDesign;
};

type Props = {
  gallery: ManagedGallery;
  collections: Collection[];
  photos: PhotoView[];
  positions: Record<string, number>;
  favoriteLists: { id: string; email: string; photoIds: string[] }[];
  downloads: DownloadRow[];
};

const TABS = [
  { id: "photos", label: "Photos", Icon: ImageIcon },
  { id: "design", label: "Design", Icon: BrushIcon },
  { id: "settings", label: "Paramètres", Icon: GearIcon },
  { id: "activity", label: "Activité", Icon: HeartIcon },
] as const;

export function GalleryManager(props: Props) {
  const { gallery } = props;
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("photos");
  const [menu, setMenu] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [activityTab, setActivityTab] = useState<"favorites" | "downloads">("favorites");
  const downloadCounts = props.downloads.reduce<Record<string, number>>((acc, d) => {
    if (d.kind === "photo" && d.photo_id) acc[d.photo_id] = (acc[d.photo_id] ?? 0) + 1;
    return acc;
  }, {});
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}/g/${gallery.slug}`);
    setMenu(false);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function remove() {
    setMenu(false);
    if (!confirm(`Supprimer définitivement la galerie « ${gallery.title} » et toutes ses photos ?`)) return;
    setDeleting(true);
    try {
      await purge("gallery", gallery.id);
      router.replace("/admin");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  }

  const status = gallery.expired ? "bg-danger" : props.photos.length > 0 ? "bg-emerald-500" : "bg-muted";

  return (
    <div className={deleting ? "opacity-40 pointer-events-none" : ""}>
      {/* En-tête */}
      <div className="flex items-center gap-2 -mx-2">
        <Link href="/admin" className="icon-btn" aria-label="Retour aux galeries">
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
        {props.photos.length} photos · {props.collections.length} collection{props.collections.length > 1 ? "s" : ""}
      </p>

      {/* Menu latéral : sections de la galerie */}
      {drawer && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 animate-[fadeIn_0.2s_ease-out_both]" onClick={() => setDrawer(false)} />
          <aside className="absolute right-0 top-0 h-full w-[78%] max-w-xs bg-bg border-l border-line px-6 pt-[max(env(safe-area-inset-top),1rem)] animate-[slideIn_0.25s_ease-out_both]">
            <div className="flex items-center justify-between h-12">
              <span className="eyebrow text-muted">Galerie</span>
              <button className="icon-btn -mr-2" onClick={() => setDrawer(false)} aria-label="Fermer">
                <CloseIcon />
              </button>
            </div>
            <nav className="mt-6">
              {TABS.map(({ id, label, Icon }) => (
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

      {tab !== "photos" && (
        <button onClick={() => setTab("photos")} className="mt-6 eyebrow text-muted hover:text-ink">← Photos</button>
      )}

      <div className="pt-6">
        {tab === "photos" && (
          <PhotosPanel
            galleryId={gallery.id}
            coverPhotoId={gallery.coverPhotoId}
            collections={props.collections}
            photos={props.photos}
            positions={props.positions}
            downloadCounts={downloadCounts}
            favoriteCounts={props.favoriteLists.reduce<Record<string, number>>((acc, l) => {
              l.photoIds.forEach((id) => (acc[id] = (acc[id] ?? 0) + 1));
              return acc;
            }, {})}
          />
        )}
        {tab === "design" && <DesignPanel gallery={gallery} photos={props.photos} />}
        {tab === "settings" && <SettingsPanel gallery={gallery} onDelete={remove} />}
        {tab === "activity" && (
          <div>
            <div className="flex border border-line mb-10">
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
  );
}
