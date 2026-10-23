import { requireAdminPage } from "@/lib/auth";
import { loadCatalog } from "@/lib/finance-data";
import { CatalogManager } from "@/components/admin/finance/catalog-manager";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const { supabase } = await requireAdminPage();
  return <CatalogManager items={await loadCatalog(supabase)} />;
}
