import { after } from "next/server";
import { amountDueNow, formatCents } from "@/lib/finance";
import type { FinanceSettings } from "@/lib/finance";
import { notifyStudio, siteOrigin } from "@/lib/finance-notify";
import { createServiceClient } from "@/lib/supabase/server";

/** Pas plus d'un e-mail « clic sur Payer » toutes les 6 h pour le même devis. */
const QUIET_MS = 6 * 3_600_000;

/**
 * Bouton « Payer » de la page du devis : note le clic, prévient le studio (« vérifiez votre Revolut »),
 * puis envoie le client sur le lien de paiement.
 */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const back = new URL(`/d/${slug}`, await siteOrigin());
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(slug)) return Response.redirect(back, 302);
  const db = createServiceClient();
  const [{ data: q }, { data: settings }] = await Promise.all([
    db.from("quotes").select("id, number, title, client_name, status, total_cents, deposit_pct, payment_link, pay_clicked_at").eq("share_slug", slug).is("deleted_at", null).maybeSingle(),
    db.from("studio_settings").select("finance").eq("id", 1).maybeSingle(),
  ]);
  const link = q?.payment_link || ((settings?.finance ?? {}) as FinanceSettings).payment_link;
  if (!q || !link || (q.status !== "sent" && q.status !== "accepted")) return Response.redirect(back, 302);

  const { data: pays } = await db.from("quote_payments").select("amount_cents").eq("quote_id", q.id);
  const due = amountDueNow({ total_cents: Number(q.total_cents), deposit_pct: q.deposit_pct }, (pays ?? []).reduce((s, p) => s + Number(p.amount_cents), 0));
  const quiet = q.pay_clicked_at && Date.now() - new Date(q.pay_clicked_at).getTime() < QUIET_MS;
  await db.from("quotes").update({ pay_clicked_at: new Date().toISOString() }).eq("id", q.id);
  if (!quiet) {
    const origin = await siteOrigin();
    const who = q.client_name || "Votre client";
    after(() =>
      notifyStudio({
        origin,
        quoteId: q.id,
        subject: `💳 ${who} a cliqué sur « Payer » (${formatCents(due.cents)})`,
        lines: [
          `${who} vient d'ouvrir votre lien de paiement pour le devis ${q.number}${q.title ? ` (${q.title})` : ""}.`,
          `Montant attendu : ${formatCents(due.cents)} (${due.label.replace("Payer", "").trim() || "paiement"}).`,
          "Vérifiez votre compte (Revolut…) puis notez le paiement dans le studio : c'est ce qui débloque la galerie.",
        ],
      }),
    );
  }
  return Response.redirect(link, 302);
}
