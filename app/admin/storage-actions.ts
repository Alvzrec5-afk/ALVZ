"use server";

import { revalidatePath } from "next/cache";
import { requireAdminApi } from "@/lib/auth";
import { STORAGE_LIMIT_CHOICES } from "@/lib/storage-limits";

/** Limite des envois choisie sur l'Accueil (sous la jauge de stockage). */
export async function setStorageLimit(gb: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase } = await requireAdminApi();
    if (!(STORAGE_LIMIT_CHOICES as readonly number[]).includes(gb)) throw new Error("Limite invalide");
    const { error } = await supabase.from("studio_settings").update({ storage_limit_gb: gb }).eq("id", 1);
    if (error) throw new Error(error.message);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
