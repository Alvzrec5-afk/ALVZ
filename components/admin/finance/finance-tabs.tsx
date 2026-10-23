"use client";

import { usePathname } from "next/navigation";
import { HoverLink } from "@/components/admin/hover-link";

const TABS = [
  { href: "/admin/finances", label: "Vue d'ensemble", match: (p: string) => p === "/admin/finances" },
  { href: "/admin/finances/devis", label: "Devis", match: (p: string) => p.startsWith("/admin/finances/devis") },
  { href: "/admin/finances/articles", label: "Articles", match: (p: string) => p.startsWith("/admin/finances/articles") },
  { href: "/admin/finances/depenses", label: "Dépenses", match: (p: string) => p.startsWith("/admin/finances/depenses") },
  { href: "/admin/finances/reglages", label: "Réglages", match: (p: string) => p.startsWith("/admin/finances/reglages") },
];

export function FinanceTabs() {
  const pathname = usePathname();
  return (
    <nav className="mt-6 mb-10 flex gap-6 border-b border-line overflow-x-auto no-scrollbar">
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <HoverLink
            key={t.href}
            href={t.href}
            className={`shrink-0 pb-3 -mb-px text-sm border-b-2 transition-colors ${active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
          </HoverLink>
        );
      })}
    </nav>
  );
}
