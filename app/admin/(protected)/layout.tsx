import { requireAdminLayout } from "@/lib/auth";
import { SessionKeeper } from "@/components/admin/session-keeper";
import { AdminShell } from "@/components/admin/admin-shell";
import { OfflineSupport } from "@/components/admin/offline-support";
import { signOut } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminLayout();
  return (
    <>
      <SessionKeeper />
      <OfflineSupport />
      <AdminShell signOut={signOut}>{children}</AdminShell>
    </>
  );
}
