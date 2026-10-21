"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BoardIcon, FilmIcon, ImageIcon, PlusIcon, SearchIcon } from "@/components/icons";

/** Nombre qui monte de 0 à sa valeur à l'ouverture de la page (sans animation si l'appareil la refuse). */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || value <= 0) return;
    const start = performance.now();
    const duration = 900;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setShown(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className={className}>{shown.toLocaleString("fr-FR")}</span>;
}

type Entry = { id: string; title: string; kind: "photo" | "video" | "board"; href: string };

/**
 * Barre d'actions de l'Accueil : recherche (⌘K / Ctrl+K) parmi les galeries, projets vidéo et tableaux, et boutons de
 * création (trois boutons à l'ordinateur, un « + » qui ouvre un petit menu au téléphone).
 */
export function DashboardActions({ galleries, boards }: { galleries: { id: string; title: string; kind: string }[]; boards: { id: string; title: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const all = useMemo<Entry[]>(
    () => [
      ...galleries.map((g) => ({ id: g.id, title: g.title, kind: (g.kind === "video" ? "video" : "photo") as Entry["kind"], href: `/admin/galleries/${g.id}` })),
      ...boards.map((b) => ({ id: b.id, title: b.title, kind: "board" as const, href: `/admin/boards/${b.id}` })),
    ],
    [galleries, boards],
  );
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const found = useMemo(() => (q.trim() ? all.filter((e) => norm(e.title).includes(norm(q.trim()))) : all).slice(0, 8), [all, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    setMenu(false);
    router.push(href);
  };
  const Icon = ({ kind }: { kind: Entry["kind"] }) =>
    kind === "video" ? <FilmIcon className="w-4 h-4" /> : kind === "board" ? <BoardIcon className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />;
  const create = [
    { label: "Galerie photo", href: "/admin/galleries/new", kind: "photo" as const },
    { label: "Projet vidéo", href: "/admin/videos/new", kind: "video" as const },
    { label: "Tableau", href: "/admin/boards/new", kind: "board" as const },
  ];

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="hidden md:contents">
          {create.map((c) => (
            <button key={c.href} onClick={() => go(c.href)} className="btn btn-ghost">
              <PlusIcon className="w-4 h-4" /> {c.label === "Galerie photo" ? "Galerie" : c.label === "Projet vidéo" ? "Projet" : "Tableau"}
            </button>
          ))}
        </span>
        <button onClick={() => setOpen(true)} className="icon-btn border border-line" aria-label="Rechercher (⌘K)" title="Rechercher (⌘K)">
          <SearchIcon className="w-4 h-4" />
        </button>
        <span className="relative md:hidden">
          <button onClick={() => setMenu((m) => !m)} className="icon-btn border border-line" aria-label="Créer" aria-expanded={menu}>
            <PlusIcon className="w-4 h-4" />
          </button>
          {menu && (
            <span className="absolute right-0 top-full mt-2 z-50 w-48 bg-bg border border-line shadow-xl py-1 animate-[fadeIn_0.15s_ease-out_both]">
              {create.map((c) => (
                <button key={c.href} onClick={() => go(c.href)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-bg-soft text-left">
                  <Icon kind={c.kind} /> {c.label}
                </button>
              ))}
            </span>
          )}
        </span>
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-start justify-center p-4 pt-[12vh] animate-[fadeIn_0.15s_ease-out_both]" onMouseDown={() => setOpen(false)}>
          <div className="w-full max-w-lg bg-bg border border-line shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 border-b border-line">
              <SearchIcon className="w-4 h-4 text-muted shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(found.length - 1, a + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(0, a - 1));
                  } else if (e.key === "Enter" && found[active]) go(found[active].href);
                }}
                placeholder="Rechercher une galerie, une vidéo, un tableau…"
                className="flex-1 bg-transparent py-4 text-[15px] outline-none"
              />
            </div>
            <ul className="max-h-[50vh] overflow-y-auto py-1">
              {found.map((e, i) => (
                <li key={e.kind + e.id}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(e.href)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left ${i === active ? "bg-bg-soft" : ""}`}
                  >
                    <span className="text-muted">
                      <Icon kind={e.kind} />
                    </span>
                    <span className="flex-1 truncate">{e.title}</span>
                    <span className="text-xs text-muted">{e.kind === "video" ? "Vidéo" : e.kind === "board" ? "Tableau" : "Galerie"}</span>
                  </button>
                </li>
              ))}
              {!found.length && <li className="px-4 py-6 text-sm text-muted text-center">Aucun résultat.</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
