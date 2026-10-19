import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { libraryBoardId } from "@/lib/boards";

export const dynamic = "force-dynamic";

/** Ouvre la « Banque d'images » (créée vide la première fois). */
export default async function BoardLibrary() {
  const { supabase } = await requireAdminPage();
  redirect(`/admin/boards/${await libraryBoardId(supabase)}`);
}
