"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * Onglets sous la barre d'un tableau : le tableau principal et ses planches (1. BUDGET, 3. MOODBOARD, 4. SHOT LIST…),
 * pour passer de l'une à l'autre en un clic. Dans une planche d'une planche, l'onglet de sa planche de départ est allumé.
 */
export function BoardTabs({
  root,
  path,
  planches,
}: {
  root: { id: string; title: string };
  path: { id: string }[];
  planches: { id: string; title: string; parentId: string }[];
}) {
  const navRef = useRef<HTMLElement>(null);
  const current = path[1]?.id ?? root.id; // planche de premier niveau qui contient le tableau ouvert
  const exact = path[path.length - 1]?.id;
  const top = planches.filter((p) => p.parentId === root.id).sort((a, b) => a.title.localeCompare(b.title, "fr", { numeric: true }));
  // L'onglet allumé reste visible quand la rangée dépasse l'écran (téléphone).
  useEffect(() => {
    const nav = navRef.current;
    const on = nav?.querySelector<HTMLElement>("[data-on]");
    if (nav && on) nav.scrollLeft = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2;
  }, [current]);
  if (!top.length) return null;
  const tabs = [{ id: root.id, title: root.title || "Tableau" }, ...top];
  return (
    <nav
      ref={navRef}
      aria-label="Planches du projet"
      className="shrink-0 relative z-[399999] flex items-center gap-1 h-10 px-2 sm:px-4 border-b border-line bg-bg overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((t, i) => {
        const on = t.id === current;
        return (
          <Link
            key={t.id}
            href={`/admin/boards/${t.id}`}
            aria-current={t.id === exact ? "page" : undefined}
            data-on={on ? "" : undefined}
            className={`shrink-0 h-7 px-3 rounded-full flex items-center text-[12px] tracking-wide transition-colors ${
              on ? "bg-bg-soft text-ink" : "text-muted hover:text-ink"
            } ${i === 0 ? "font-medium" : ""}`}
          >
            {t.title || "Sans titre"}
          </Link>
        );
      })}
    </nav>
  );
}
