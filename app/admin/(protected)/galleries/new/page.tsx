import Link from "next/link";
import { GalleryForm } from "@/components/admin/gallery-form";
import { createGallery } from "../../../actions";

export const metadata = { title: "Nouvelle galerie" };

export default function NewGallery() {
  return (
    <div>
      <Link href="/admin" className="eyebrow text-muted hover:text-ink">← Galeries</Link>
      <h1 className="display text-5xl mt-6 mb-12">Nouvelle galerie</h1>
      <GalleryForm
        action={createGallery}
        submitLabel="Créer la galerie"
        values={{ title: "", event_date: "", expires_at: "", watermark: false, downloads_enabled: true, theme: "dark", hasPassword: false }}
      />
    </div>
  );
}
