import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { templateBoardId } from "@/lib/boards";

export const dynamic = "force-dynamic";

/** Ouvre le « Modèle des nouveaux tableaux » (créé avec les six planches la première fois). */
export default async function BoardModel() {
  const { supabase } = await requireAdminPage();
  redirect(`/admin/boards/${await templateBoardId(supabase)}`);
}
