import { requireAdminPage } from "@/lib/auth";
import { loadExpenses } from "@/lib/finance-data";
import { ExpensesManager } from "@/components/admin/finance/expenses-manager";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const { supabase } = await requireAdminPage();
  return <ExpensesManager expenses={await loadExpenses(supabase)} />;
}
