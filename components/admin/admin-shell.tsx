"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/wordmark";
import { BackgroundStatus } from "./background";
import { clearOffline } from "./offline-support";
import { BoardIcon, GlobeIcon, HomeIcon, TrashIcon, CardIcon, CloseIcon, DotsIcon, FilmIcon, ImageIcon, LogoutIcon, MegaphoneIcon } from "@/components/icons";

const NAV = [
  { href: "/admin", label: "Accueil", Icon: HomeIcon, match: (p: string) => p === "/admin" },
  { href: "/admin/galleries", label: "Galeries", Icon: ImageIcon, match: (p: string) => p.startsWith("/admin/galleries") },
  { href: "/admin/videos", label: "Vidéos", Icon: FilmIcon, match: (p: string) => p.startsWith("/admin/videos") },
  { href: "/admin/boards", label: "Tableaux", Icon: BoardIcon, match: (p: string) => p.startsWith("/admin/boards") },
  { href: "/admin/site", label: "Site", Icon: GlobeIcon, match: (p: string) => p.startsWith("/admin/site") },
  { href: "/admin/settings", label: "Coordonnées", Icon: CardIcon, match: (p: string) => p.startsWith("/admin/settings") },
];
const TOOLS = [
  { href: "/admin/clients", label: "Clients & e-mails", Icon: MegaphoneIcon, match: (p: string) => p.startsWith("/admin/clients") },
  { href: "/admin/trash", label: "Corbeille", Icon: TrashIcon, match: (p: string) => p.startsWith("/admin/trash") },
];

/** Onglets de la barre du bas (téléphone) ; « Plus » ouvre le reste du menu. */
const TABS = NAV.slice(0, 4);

/**
 * Téléphone : logo en haut et onglets en bas de l'écran (comme une app). Ordinateur : menu latéral à gauche (comme Pixieset) ;
 * la page d'une galerie occupe tout l'écran avec sa propre barre.
 */
export function AdminShell({ children, signOut }: { children: React.ReactNode; signOut: () => Promise<void> }) {
  const pathname = usePathname();
  const galleryPage = /^\/admin\/galleries\/(?!new)[^/]+/.test(pathname);
  // Un tableau occupe tout l'écran, avec sa propre barre (aussi sur téléphone).
  const boardPage = /^\/admin\/boards\/(?!new)[^/]+/.test(pathname);
  const [menu, setMenu] = useState(false);
  const tabBar = !boardPage && !galleryPage;
  // Hauteur de la barre du bas, pour que les bulles d'état (envois en arrière-plan…) passent au-dessus.
  useEffect(() => {
    document.documentElement.style.setProperty("--tabbar", tabBar ? "4.25rem" : "0px");
  }, [tabBar]);

  if (boardPage)
    return (
      <main className="h-svh">
        {children}
        <BackgroundStatus />
      </main>
    );

  return (
    <div className="min-h-svh">
      {/* Téléphone : logo au milieu, barre fixe en haut (l'app iPhone n'a pas de barre Safari), décalée sous l'heure. */}
      <header className="border-b border-line lg:hidden sticky top-0 z-40 bg-bg pt-[env(safe-area-inset-top)]">
        <div className="px-3 h-14 flex items-center justify-center">
          <Link href="/admin">
            <Wordmark height={30} variant="studio" />
          </Link>
        </div>
      </header>

      {/* Téléphone : onglets en bas de l'écran, au-dessus de la barre d'accueil de l'iPhone. */}
      {tabBar && (
        <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-5 h-[4.25rem]">
            {TABS.map((t) => {
              const active = t.match(pathname);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`relative flex flex-col items-center justify-center gap-1 text-[11px] transition-colors ${active ? "text-ink" : "text-muted"}`}
                >
                  <span className={`absolute top-0 h-[2px] w-8 rounded-full bg-ink transition-all duration-300 ${active ? "opacity-100" : "opacity-0 scale-x-0"}`} />
                  <t.Icon className={`w-[22px] h-[22px] transition-transform duration-300 ${active ? "-translate-y-0.5" : ""}`} />
                  {t.label}
                </Link>
              );
            })}
            <button onClick={() => setMenu(true)} className={`flex flex-col items-center justify-center gap-1 text-[11px] ${menu ? "text-ink" : "text-muted"}`} aria-label="Plus">
              <DotsIcon className="w-[22px] h-[22px]" />
              Plus
            </button>
          </div>
        </nav>
      )}

      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 animate-[fadeIn_0.2s_ease-out_both]" onClick={() => setMenu(false)} />
          {/* « Plus » : le menu complet monte du bas de l'écran. */}
          <aside className="absolute inset-x-0 bottom-0 max-h-[85svh] overflow-y-auto bg-bg border-t border-line rounded-t-2xl flex flex-col pb-[env(safe-area-inset-bottom)] animate-[sheetUp_0.28s_cubic-bezier(.2,.8,.2,1)_both]">
            <span className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line" aria-hidden />
            <div className="flex items-center justify-between h-14 px-6">
              <span className="eyebrow text-muted">Studio</span>
              <button className="icon-btn -mr-2" onClick={() => setMenu(false)} aria-label="Fermer">
                <CloseIcon />
              </button>
            </div>
            <nav className="flex-1" onClick={() => setMenu(false)}>
              {[...NAV.slice(TABS.length), ...TOOLS].map((item) => (
                <NavItem key={item.href} {...item} active={item.match(pathname)} />
              ))}
            </nav>
            <form action={signOut} onSubmit={clearOffline} className="border-t border-line">
              <button className="w-full flex items-center gap-4 px-7 h-14 text-[15px] text-muted hover:text-ink transition-colors">
                <LogoutIcon /> Déconnexion
              </button>
            </form>
          </aside>
        </div>
      )}

      {!galleryPage && (
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-line bg-bg z-30">
          <Link href="/admin" className="flex items-center h-20 shrink-0 px-7 border-b border-line">
            <Wordmark height={34} variant="studio" />
          </Link>
          <nav className="py-4 flex-1 overflow-y-auto">
            {NAV.map((item) => (
              <NavItem key={item.href} {...item} active={item.match(pathname)} />
            ))}
            <p className="px-7 pt-8 pb-2 text-xs text-muted">Outils</p>
            {TOOLS.map((item) => (
              <NavItem key={item.href} {...item} active={item.match(pathname)} />
            ))}
          </nav>
          <form action={signOut} onSubmit={clearOffline} className="border-t border-line">
            <button className="w-full flex items-center gap-4 px-7 h-14 text-sm text-muted hover:text-ink transition-colors">
              <LogoutIcon /> Déconnexion
            </button>
          </form>
        </aside>
      )}

      <main
        className={
          galleryPage
            ? "px-5 sm:px-8 py-6 lg:p-0"
            : "mx-auto max-w-6xl px-5 sm:px-8 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pt-14 lg:pb-10 lg:max-w-none lg:mx-0 lg:ml-64 lg:px-12 lg:pt-10"
        }
      >
        {children}
      </main>
      <BackgroundStatus />
    </div>
  );
}

function NavItem({ href, label, Icon, active }: { href: string; label: string; Icon: typeof ImageIcon; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 px-7 h-14 text-[15px] transition-colors ${active ? "bg-bg-soft text-ink" : "text-muted hover:text-ink"}`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </Link>
  );
}
