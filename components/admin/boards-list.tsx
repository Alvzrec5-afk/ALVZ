"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GridIcon, MenuIcon } from "@/components/icons";
import { BoardCardMenu } from "./board-card-menu";

export type BoardRow = { id: string; title: string; cover: string | null; meta: string; updated: string };

/** Vignette : la couverture choisie, sinon le nom du projet en grand. */
function Cover({ b, small }: { b: BoardRow; small?: boolean }) {
  if (b.cover) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={b.cover} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />;
  }
  return (
    <span className={`w-full h-full flex items-center justify-center text-center ${small ? "p-1" : "p-5"}`}>
      <span
        className={`display uppercase leading-[1.05] break-words ${small ? "text-[11px] tracking-wide" : "text-2xl sm:text-3xl lg:text-4xl tracking-wider"}`}
        style={{ display: "-webkit-box", WebkitLineClamp: small ? 3 : 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        {small ? b.title.slice(0, 2) : b.title}
      </span>
    </span>
  );
}

/** Liste des tableaux : grande grille ou liste à petites vignettes (choix mémorisé). */
export function BoardsList({ boards }: { boards: BoardRow[] }) {
  const [view, setView] = useState<"grid" | "list">("grid");
  useEffect(() => {
    try {
      if (localStorage.getItem("boards-view") === "list") setView("list");
    } catch {}
  }, []);
  const change = (v: "grid" | "list") => {
    setView(v);
    try {
      localStorage.setItem("boards-view", v);
    } catch {}
  };

  return (
    <div className="mt-12">
      <div className="flex justify-end gap-1 mb-4 text-muted">
        <button onClick={() => change("grid")} className={`icon-btn ${view === "grid" ? "text-ink" : ""}`} aria-label="Grille" title="Grille">
          <GridIcon />
        </button>
        <button onClick={() => change("list")} className={`icon-btn ${view === "list" ? "text-ink" : ""}`} aria-label="Liste" title="Liste">
          <MenuIcon />
        </button>
      </div>

      {view === "grid" ? (
        <ul className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10">
          {boards.map((b) => (
            <li key={b.id} className="relative">
              <BoardCardMenu id={b.id} title={b.title} hasCover={Boolean(b.cover)} />
              <Link prefetch={false} href={`/admin/boards/${b.id}`} className="group block">
                <div className="aspect-[4/3] bg-bg-soft overflow-hidden border border-line">
                  <Cover b={b} />
                </div>
                <p className="mt-3 text-[15px] truncate">{b.title}</p>
                <p className="text-xs text-muted mt-1 truncate">{b.meta}</p>
                <p className="text-[11px] text-muted mt-0.5">{b.updated}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="border-t border-line">
          {boards.map((b) => (
            <li key={b.id} className="relative border-b border-line">
              <Link prefetch={false} href={`/admin/boards/${b.id}`} className="group flex items-center gap-4 py-3 pr-14">
                <span className="w-14 h-14 shrink-0 bg-bg-soft border border-line overflow-hidden">
                  <Cover b={b} small />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] truncate">{b.title}</span>
                  <span className="block text-xs text-muted truncate">
                    {b.meta} · {b.updated}
                  </span>
                </span>
              </Link>
              <BoardCardMenu id={b.id} title={b.title} hasCover={Boolean(b.cover)} className="top-1/2 -translate-y-1/2 right-0" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
