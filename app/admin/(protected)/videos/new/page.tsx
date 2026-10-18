import Link from "next/link";
import { CreateGalleryForm } from "@/components/admin/gallery-form";

export const metadata = { title: "Nouveau projet vidéo" };

export default function NewVideoProject() {
  return (
    <div>
      <Link href="/admin/videos" className="eyebrow text-muted hover:text-ink">← Vidéos</Link>
      <h1 className="display text-4xl sm:text-5xl mt-6 mb-12">Nouveau projet vidéo</h1>
      <CreateGalleryForm kind="video" />
      <p className="text-xs text-muted mt-10 max-w-xl">
        Ensuite, ajoutez votre clip : il a son propre lien client, avec lecture adaptée à la connexion, commentaires sur la
        timeline et téléchargement si vous l&apos;autorisez.
      </p>
    </div>
  );
}
