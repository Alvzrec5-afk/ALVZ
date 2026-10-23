import { requireAdminPage } from "@/lib/auth";
import { loadFinanceSettings } from "@/lib/finance-data";
import { FinanceSettingsForm } from "@/components/admin/finance/finance-settings-form";

export const dynamic = "force-dynamic";

export default async function FinanceSettingsPage() {
  const { supabase } = await requireAdminPage();
  return <FinanceSettingsForm settings={await loadFinanceSettings(supabase)} />;
}
