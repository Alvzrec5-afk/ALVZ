import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { SessionKeeper } from "@/components/admin/session-keeper";
import { signOut } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <div className="min-h-svh">
      <SessionKeeper />
      <header className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/admin" className="eyebrow tracking-[0.42em]">ALVZ.REC <span className="text-muted ml-2 tracking-[0.2em]">studio</span></Link>
          <form action={signOut}>
            <button className="eyebrow text-muted hover:text-ink transition-colors">Déconnexion</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-14">{children}</main>
    </div>
  );
}
