import { redirect } from "next/navigation";

/** Ancienne adresse de l'accueil : l'accueil est maintenant /admin. */
export default function OldHome() {
  redirect("/admin");
}
