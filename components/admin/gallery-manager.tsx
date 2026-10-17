"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { regenerateLink, updateGallery } from "@/app/admin/actions";
import type { Collection, PhotoView } from "@/lib/types";
import { GalleryForm, type GalleryFormValues } from "./gallery-form";
import { PhotosPanel } from "./photos-panel";
import { FavoritesPanel } from "./favorites-panel";
import { purge } from "./purge";

type Props = {
  gallery: { id: string; slug: string; title: string; coverPhotoId: string | null; form: GalleryFormValues };
  collections: Collection[];
  photos: PhotoView[];
  positions: Record<string, number>;
  favoriteLists: { id: string; email: string; photoIds: string[] }[];
};

const TABS = [
  { id: "photos", label: "Photos" },
  { id: "settings", label: "Paramètres" },
  { id: "favorites", label: "Favoris" },
] as const;

export function GalleryManager(props: Props) {
  const { gallery } = props;
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("photos");
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const link = () => `${window.location.origin}/g/${gallery.slug}`;

  async function copy() {
    await navigator.clipboard.writeText(link());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function remove() {
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

  return (
    <div>
      <Link href="/admin" className="eyebrow text-muted hover:text-ink">← Galeries</Link>
      <div className="mt-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div className="min-w-0">
          <h1 className="display text-5xl break-words">{gallery.title}</h1>
          <p className="text-xs text-muted mt-3">{props.photos.length} photos · {props.collections.length} collection{props.collections.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={copy} className="btn">{copied ? "Lien copié ✓" : "Copier le lien"}</button>
          <a href={`/g/${gallery.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost">Voir la galerie</a>
        </div>
      </div>

      <nav className="mt-12 border-b border-line flex gap-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`eyebrow pb-4 -mb-px border-b transition-colors ${tab === t.id ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
            {t.id === "favorites" && props.favoriteLists.length > 0 && <span className="ml-2 text-muted">{props.favoriteLists.length}</span>}
          </button>
        ))}
      </nav>

      <div className="pt-10">
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
        {tab === "settings" && (
          <div className="space-y-20">
            <GalleryForm action={updateGallery.bind(null, gallery.id)} values={gallery.form} submitLabel="Enregistrer" />
            <section className="border-t border-line pt-10 max-w-xl space-y-4">
              <h2 className="label">Lien secret</h2>
              <p className="text-sm text-muted">
                Générer un nouveau lien rend l&apos;ancien inutilisable (utile si le lien a circulé par erreur).
              </p>
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  if (!confirm("Générer un nouveau lien ? L'ancien ne fonctionnera plus.")) return;
                  await regenerateLink(gallery.id);
                  router.refresh();
                }}
              >
                Nouveau lien
              </button>
            </section>
            <section className="border-t border-line pt-10 max-w-xl space-y-4">
              <h2 className="label text-danger">Zone sensible</h2>
              <button className="btn btn-danger" onClick={remove} disabled={deleting}>
                {deleting ? "Suppression…" : "Supprimer la galerie"}
              </button>
            </section>
          </div>
        )}
        {tab === "favorites" && <FavoritesPanel lists={props.favoriteLists} photos={props.photos} collections={props.collections} />}
      </div>
    </div>
  );
}
