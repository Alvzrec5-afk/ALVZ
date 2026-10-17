"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GalleryDesign } from "@/lib/design";
import type { Collection, PhotoView } from "@/lib/types";
import { ArrowLeft, BrushIcon, DotsIcon, GearIcon, HeartIcon, ImageIcon } from "@/components/icons";
import { PhotosPanel } from "./photos-panel";
import { DesignPanel } from "./design-panel";
import { SettingsPanel } from "./settings-panel";
import { FavoritesPanel } from "./favorites-panel";
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
        <span className="hidden sm:block">
          <button onClick={copy} className="btn btn-ghost">{copied ? "Lien copié ✓" : "Copier le lien"}</button>
        </span>
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
      </div>
      {copied && <p className="sm:hidden text-xs text-emerald-400 mt-1">Lien copié ✓</p>}

      <p className="text-xs text-muted mt-2">
        {props.photos.length} photos · {props.collections.length} collection{props.collections.length > 1 ? "s" : ""}
      </p>

      {/* Onglets à icônes */}
      <nav className="mt-6 grid grid-cols-4 border-b border-line -mx-5 sm:mx-0">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-col items-center gap-1.5 pt-3 pb-3 border-b-2 -mb-px transition-colors ${tab === id ? "border-emerald-500 text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] tracking-[0.18em] uppercase">
              {label}
              {id === "activity" && props.favoriteLists.length > 0 ? ` ${props.favoriteLists.length}` : ""}
            </span>
          </button>
        ))}
      </nav>

      <div className="pt-8">
        {tab === "photos" && (
          <PhotosPanel
            galleryId={gallery.id}
            coverPhotoId={gallery.coverPhotoId}
            collections={props.collections}
            photos={props.photos}
            positions={props.positions}
            favoriteCounts={props.favoriteLists.reduce<Record<string, number>>((acc, l) => {
              l.photoIds.forEach((id) => (acc[id] = (acc[id] ?? 0) + 1));
              return acc;
            }, {})}
          />
        )}
        {tab === "design" && <DesignPanel gallery={gallery} photos={props.photos} />}
        {tab === "settings" && <SettingsPanel gallery={gallery} onDelete={remove} />}
        {tab === "activity" && <FavoritesPanel lists={props.favoriteLists} photos={props.photos} collections={props.collections} />}
      </div>
    </div>
  );
}
