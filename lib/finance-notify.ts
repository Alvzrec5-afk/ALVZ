import "server-only";
import { headers } from "next/headers";
import type { Contact } from "@/lib/contact";
import type { FinanceSettings } from "@/lib/finance";
import { createMailer, mailerConfigured } from "@/lib/mailer";
import { createServiceClient } from "@/lib/supabase/server";

/** Adresse du site (pour le lien vers la fiche du devis dans le studio). */
export async function siteOrigin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

/**
 * Prévient le studio par e-mail (à lui-même) : devis accepté, clic sur « Payer »…
 * Ne bloque jamais le client : toute erreur est seulement notée dans les journaux.
 */
export async function notifyStudio({ subject, lines, quoteId, origin }: { subject: string; lines: string[]; quoteId: string; origin: string }) {
  if (!mailerConfigured()) return;
  try {
    const { data } = await createServiceClient().from("studio_settings").select("finance, contact").eq("id", 1).maybeSingle();
    const finance = (data?.finance ?? {}) as FinanceSettings;
    const contact = (data?.contact ?? {}) as Contact;
    const { transport, from } = createMailer();
    const link = `${origin}/admin/finances/devis/${quoteId}`;
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
    await transport.sendMail({
      from: { name: "ALVZ Studio", address: from },
      to: finance.email || contact.email || from,
      subject,
      text: [...lines, "", `Ouvrir le devis : ${link}`].join("\n"),
      html: `<!doctype html><html><body style="margin:0;padding:24px;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a">
${lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join("")}
<p style="margin:24px 0 0"><a href="${esc(link)}" style="display:inline-block;padding:12px 20px;background:#161514;color:#fff;text-decoration:none;font-size:13px;letter-spacing:.12em;text-transform:uppercase">Ouvrir le devis</a></p>
</body></html>`,
    });
    transport.close();
  } catch (e) {
    console.error("Notification au studio impossible", e);
  }
}
