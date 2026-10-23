"use server";

import { revalidatePath } from "next/cache";
import { todayParis } from "@/lib/finance";
import { createServiceClient } from "@/lib/supabase/server";

/** « Bon pour accord » du client, depuis la page publique du devis (lien secret). */
export async function acceptQuote(slug: string, _: { error?: string; ok?: boolean } | null, form: FormData) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(slug)) return { error: "Devis introuvable." };
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  if (name.length < 2) return { error: "Indiquez votre nom." };
  if (form.get("agree") !== "on") return { error: "Cochez la case « Bon pour accord »." };
  const db = createServiceClient();
  const { data: q } = await db.from("quotes").select("id, status, valid_until").eq("share_slug", slug).is("deleted_at", null).maybeSingle();
  if (!q) return { error: "Devis introuvable." };
  if (q.status !== "sent") return { error: "Ce devis ne peut plus être accepté en ligne. Contactez-moi directement." };
  if (q.valid_until && q.valid_until < todayParis()) return { error: "Ce devis a expiré. Contactez-moi pour un nouveau devis." };
  const { error } = await db
    .from("quotes")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_name: name, updated_at: new Date().toISOString() })
    .eq("id", q.id)
    .eq("status", "sent");
  if (error) return { error: "Impossible d'enregistrer l'accord, réessayez." };
  revalidatePath(`/d/${slug}`);
  revalidatePath("/admin/finances", "layout");
  return { ok: true };
}
