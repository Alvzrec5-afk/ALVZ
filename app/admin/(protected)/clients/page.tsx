import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { loadAudience } from "@/lib/audience";
import { mailerConfigured } from "@/lib/mailer";
import { ClientsManager, type Campaign } from "@/components/admin/clients-manager";

export const metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const { supabase } = await requireAdminPage();
  const [audience, campaigns] = await Promise.all([
    loadAudience(supabase),
    supabase.from("mail_campaigns").select("id, subject, recipients, sent, failed, created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  return (
    <div className="max-w-3xl">
      <Link href="/admin" className="eyebrow text-muted hover:text-ink lg:hidden">← Accueil</Link>
      <h1 className="display text-4xl sm:text-5xl mt-6 lg:mt-0">Clients</h1>
      <p className="text-sm text-muted mt-4 leading-relaxed">
        Les adresses laissées dans vos galeries (sélection de favoris, téléchargements). Écrivez-leur depuis votre boîte mail :
        chaque personne reçoit son propre e-mail et ne voit que sa propre adresse.
      </p>
      <ClientsManager audience={audience} campaigns={(campaigns.data ?? []) as Campaign[]} configured={mailerConfigured()} />
    </div>
  );
}
