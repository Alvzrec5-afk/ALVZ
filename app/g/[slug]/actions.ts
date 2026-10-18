"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { findGalleryBySlug, grantAccess, isExpired } from "@/lib/gallery-access";

export async function unlockGallery(slug: string, next: string | undefined, _: { error?: string } | null, form: FormData) {
  const gallery = await findGalleryBySlug(slug);
  if (!gallery || isExpired(gallery)) redirect(`/g/${slug}`);
  if (!gallery.password_hash) redirect(`/g/${slug}`);
  const password = String(form.get("password") ?? "");
  const ok = password.length > 0 && (await bcrypt.compare(password, gallery.password_hash));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600)); // ralentit les essais en série
    return { error: "Mot de passe incorrect." };
  }
  await grantAccess(gallery);
  // Retour à la page demandée (ex. lien direct vers une vidéo), uniquement dans cette galerie.
  redirect(next && next.startsWith(`/g/${slug}/`) && !next.includes("//") ? next : `/g/${slug}`);
}
