import type { NextRequest } from "next/server";
import { apiError, requireAdminApi } from "@/lib/auth";
import { loadAudience, unsubscribeToken } from "@/lib/audience";
import type { Contact } from "@/lib/contact";
import { buildMessage, createMailer } from "@/lib/mailer";

export const maxDuration = 60;

const BATCH = 10;

type Body = { subject?: string; body?: string; emails?: string[]; total?: number; campaignId?: string; test?: boolean };

/**
 * Envoie un message à un lot d'adresses (10 max par appel : la page enchaîne les lots).
 * Chaque destinataire reçoit son propre e-mail, adressé à lui seul.
 */
export async function POST(req: NextRequest) {
  try {
    const { supabase } = await requireAdminApi();
    const input = (await req.json()) as Body;
    const subject = String(input.subject ?? "").trim().slice(0, 200);
    const body = String(input.body ?? "").trim().slice(0, 10000);
    if (!subject || !body) return Response.json({ error: "Objet et message obligatoires." }, { status: 400 });

    const { transport, from } = createMailer();
    const { data: settings } = await supabase.from("studio_settings").select("contact").eq("id", 1).maybeSingle();
    const contact = (settings?.contact as Contact) ?? {};
    const sender = { name: contact.name?.split(/\s+[—-]\s+/)[0] || "ALVZ.REC", address: from };

    let recipients: string[];
    if (input.test) {
      recipients = [from];
    } else {
      const wanted = new Set((input.emails ?? []).map((e) => String(e).trim().toLowerCase()));
      if (wanted.size === 0 || wanted.size > BATCH) return Response.json({ error: "Lot d'adresses invalide." }, { status: 400 });
      // Seules les adresses de vos clients, non désinscrites, sont acceptées.
      recipients = (await loadAudience(supabase)).filter((m) => !m.unsubscribed && wanted.has(m.email)).map((m) => m.email);
    }

    let campaignId = input.campaignId ?? null;
    if (!input.test && !campaignId) {
      const { data, error } = await supabase
        .from("mail_campaigns")
        .insert({ subject, body, recipients: Math.max(0, Math.floor(Number(input.total) || 0)) })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      campaignId = data.id as string;
    }

    const sent: string[] = [];
    const failed: { email: string; error: string }[] = [];
    for (const to of recipients) {
      const unsubscribeUrl = `${req.nextUrl.origin}/desinscription?t=${encodeURIComponent(unsubscribeToken(to))}`;
      const { text, html } = buildMessage({ body, contact, unsubscribeUrl, origin: req.nextUrl.origin });
      try {
        await transport.sendMail({
          from: sender,
          to,
          replyTo: contact.email || undefined,
          subject: input.test ? `[Test] ${subject}` : subject,
          text,
          html,
          headers: {
            "List-Unsubscribe": `<${req.nextUrl.origin}/api/unsubscribe?t=${encodeURIComponent(unsubscribeToken(to))}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        sent.push(to);
      } catch (e) {
        failed.push({ email: to, error: e instanceof Error ? e.message : "Erreur d'envoi" });
      }
    }
    transport.close();

    if (campaignId) {
      const { data: c } = await supabase.from("mail_campaigns").select("sent, failed").eq("id", campaignId).single();
      if (c) {
        await supabase
          .from("mail_campaigns")
          .update({ sent: c.sent + sent.length, failed: c.failed + failed.length })
          .eq("id", campaignId);
      }
    }
    return Response.json({ campaignId, sent, failed });
  } catch (e) {
    return apiError(e);
  }
}
