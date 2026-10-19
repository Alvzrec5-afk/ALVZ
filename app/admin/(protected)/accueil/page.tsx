import { requireAdminPage } from "@/lib/auth";
import { storageUsage, studioOverview } from "@/lib/usage";
import { StudioDashboard } from "@/components/admin/studio-dashboard";

export const metadata = { title: "Accueil" };
export const dynamic = "force-dynamic";

/** Accueil du studio (centre de contrôle) : chiffres, stockage détaillé, projets récents. */
export default async function StudioHome() {
  const { supabase } = await requireAdminPage();
  const [o, usage, { data: galleries }, { data: boards }] = await Promise.all([
    studioOverview(supabase),
    storageUsage(supabase),
    supabase.from("galleries").select("id, title, kind, created_at").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase
      .from("boards")
      .select("id, title, updated_at")
      .is("parent_id", null)
      .is("deleted_at", null)
      .eq("is_template", false)
      .eq("is_library", false)
      .order("updated_at", { ascending: false })
      .limit(4),
  ]);
  return (
    <StudioDashboard
      o={o}
      usage={usage}
      galleries={(galleries ?? []) as { id: string; title: string; kind: string; created_at: string }[]}
      boards={(boards ?? []) as { id: string; title: string; updated_at: string }[]}
    />
  );
}
