import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import type { Contact } from "@/lib/contact";
import { ContactForm } from "@/components/admin/contact-form";

export const metadata = { title: "Coordonnées" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("studio_settings").select("contact").eq("id", 1).maybeSingle();
  return (
    <div className="max-w-xl">
      <Link href="/admin" className="eyebrow text-muted hover:text-ink lg:hidden">← Accueil</Link>
      <h1 className="display text-4xl sm:text-5xl mt-6 lg:mt-0">Carte de visite</h1>
      <p className="text-sm text-muted mt-4 leading-relaxed">
        Ces coordonnées apparaissent en bas de vos galeries, pour que vos clients et leurs proches puissent vous
        contacter directement. Laissez vide ce que vous ne voulez pas afficher.
      </p>
      <div className="mt-12">
        <ContactForm contact={(data?.contact as Contact) ?? {}} />
      </div>
    </div>
  );
}
