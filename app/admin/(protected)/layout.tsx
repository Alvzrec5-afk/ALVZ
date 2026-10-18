import { requireAdminPage } from "@/lib/auth";
import { SessionKeeper } from "@/components/admin/session-keeper";
import { AdminShell } from "@/components/admin/admin-shell";
import { signOut } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <>
      <SessionKeeper />
      <AdminShell signOut={signOut}>{children}</AdminShell>
    </>
  );
}
