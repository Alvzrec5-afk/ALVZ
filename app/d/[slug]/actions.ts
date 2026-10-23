"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { amountDueNow, formatCents, todayParis } from "@/lib/finance";
import { notifyStudio, siteOrigin } from "@/lib/finance-notify";
import { confirmEventsForQuote } from "@/lib/calendar-server";
import { createServiceClient } from "@/lib/supabase/server";

/** « Bon pour accord » du client, depuis la page publique du devis (lien secret). */
export async function acceptQuote(slug: string, _: { error?: string; ok?: boolean } | null, form: FormData) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(slug)) return { error: "Devis introuvable." };
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  if (name.length < 2) return { error: "Indiquez votre nom." };
  if (form.get("agree") !== "on") return { error: "Cochez la case « Bon pour accord »." };
  const db = createServiceClient();
  const { data: q } = await db.from("quotes").select("id, number, title, client_name, status, valid_until, total_cents, deposit_pct").eq("share_slug", slug).is("deleted_at", null).maybeSingle();
  if (!q) return { error: "Devis introuvable." };
  if (q.status !== "sent") return { error: "Ce devis ne peut plus être accepté en ligne. Contactez-moi directement." };
  if (q.valid_until && q.valid_until < todayParis()) return { error: "Ce devis a expiré. Contactez-moi pour un nouveau devis." };
  const { error } = await db
    .from("quotes")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_name: name, updated_at: new Date().toISOString() })
    .eq("id", q.id)
    .eq("status", "sent");
  if (error) return { error: "Impossible d'enregistrer l'accord, réessayez." };
  const origin = await siteOrigin();
  const { data: pays } = await db.from("quote_payments").select("amount_cents").eq("quote_id", q.id);
  const due = amountDueNow({ total_cents: Number(q.total_cents), deposit_pct: q.deposit_pct }, (pays ?? []).reduce((s, p) => s + Number(p.amount_cents), 0));
  after(() =>
    notifyStudio({
      origin,
      quoteId: q.id,
      subject: `✅ Devis ${q.number} accepté par ${name}`,
      lines: [
        `${name} vient d'accepter le devis ${q.number}${q.title ? ` (${q.title})` : ""} : ${formatCents(Number(q.total_cents))}.`,
        due.cents > 0 ? `${due.label.replace("Payer", "À recevoir :")} ${formatCents(due.cents)}.` : "",
        "Pensez à noter le paiement dans le studio dès qu'il arrive : c'est ce qui débloque la galerie.",
      ].filter(Boolean),
    }),
  );
  // Date en option reliée à ce devis : validée, projets créés (galerie, vidéo, tableau), après la réponse au client.
  after(() => confirmEventsForQuote(db, q.id));
  revalidatePath(`/d/${slug}`);
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/finances", "layout");
  return { ok: true };
}
