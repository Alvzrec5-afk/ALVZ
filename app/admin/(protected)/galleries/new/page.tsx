import Link from "next/link";
import { CreateGalleryForm } from "@/components/admin/gallery-form";

export const metadata = { title: "Nouvelle galerie" };

export default function NewGallery() {
  return (
    <div>
      <Link href="/admin" className="eyebrow text-muted hover:text-ink">← Galeries</Link>
      <h1 className="display text-4xl sm:text-5xl mt-6 mb-12">Nouvelle galerie</h1>
      <CreateGalleryForm />
      <p className="text-xs text-muted mt-10 max-w-xl">
        Couverture, typographie, couleurs, grille, téléchargement et favoris se règlent ensuite dans la galerie.
      </p>
    </div>
  );
}
