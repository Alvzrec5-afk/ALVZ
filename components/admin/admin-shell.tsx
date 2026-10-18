"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { CardIcon, ImageIcon, LogoutIcon, MegaphoneIcon } from "@/components/icons";

const NAV = [
  { href: "/admin", label: "Galeries", Icon: ImageIcon, match: (p: string) => p === "/admin" || p.startsWith("/admin/galleries") },
  { href: "/admin/settings", label: "Coordonnées", Icon: CardIcon, match: (p: string) => p.startsWith("/admin/settings") },
];
const TOOLS = [{ href: "/admin/clients", label: "Clients & e-mails", Icon: MegaphoneIcon, match: (p: string) => p.startsWith("/admin/clients") }];

/**
 * Mobile : barre en haut. Ordinateur : menu latéral à gauche (comme Pixieset) ;
 * la page d'une galerie occupe tout l'écran avec sa propre barre.
 */
export function AdminShell({ children, signOut }: { children: React.ReactNode; signOut: () => Promise<void> }) {
  const pathname = usePathname();
  const galleryPage = /^\/admin\/galleries\/(?!new)[^/]+/.test(pathname);

  return (
    <div className="min-h-svh">
      <header className="border-b border-line lg:hidden">
        <div className="px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3 shrink-0">
            <Wordmark height={30} />
            <span className="eyebrow text-muted tracking-[0.2em] hidden sm:inline">studio</span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/admin/clients" className="eyebrow text-muted hover:text-ink transition-colors">Clients</Link>
            <Link href="/admin/settings" className="eyebrow text-muted hover:text-ink transition-colors">
              <span className="sm:hidden">Infos</span>
              <span className="hidden sm:inline">Coordonnées</span>
            </Link>
            <form action={signOut} className="flex">
              <button className="text-muted hover:text-ink transition-colors" aria-label="Déconnexion" title="Déconnexion">
                <LogoutIcon />
              </button>
            </form>
          </div>
        </div>
      </header>

      {!galleryPage && (
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-line bg-bg z-30">
          <Link href="/admin" className="flex items-center gap-3 h-20 px-7 border-b border-line">
            <Wordmark height={28} />
            <span className="eyebrow text-muted tracking-[0.2em]">studio</span>
          </Link>
          <nav className="py-4 flex-1">
            {NAV.map((item) => (
              <NavItem key={item.href} {...item} active={item.match(pathname)} />
            ))}
            <p className="px-7 pt-8 pb-2 text-xs text-muted">Outils</p>
            {TOOLS.map((item) => (
              <NavItem key={item.href} {...item} active={item.match(pathname)} />
            ))}
          </nav>
          <form action={signOut} className="border-t border-line">
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
            : "mx-auto max-w-6xl px-5 sm:px-8 py-6 sm:py-14 lg:max-w-none lg:mx-0 lg:ml-64 lg:px-12 lg:py-10"
        }
      >
        {children}
      </main>
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
