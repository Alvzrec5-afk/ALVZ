import Link from "next/link";
import { FinanceTabs } from "@/components/admin/finance/finance-tabs";

export const metadata = { title: "Finances" };

export default function FinancesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-5xl">
      <Link href="/admin" className="eyebrow text-muted hover:text-ink lg:hidden">← Accueil</Link>
      <h1 className="display text-4xl sm:text-5xl mt-6 lg:mt-0">Finances</h1>
      <FinanceTabs />
      {children}
    </div>
  );
}
