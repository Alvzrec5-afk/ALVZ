import "server-only";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { contactLinks, type Contact } from "@/lib/contact";

export function mailerConfigured() {
  return env.smtp() !== null;
}

export function createMailer() {
  const smtp = env.smtp();
  if (!smtp) throw new Error("Envoi d'e-mails non configuré : ajoutez SMTP_USER et SMTP_PASS sur Netlify.");
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
    pool: true,
    maxConnections: 1,
  });
  return { transport, from: smtp.user };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Message sobre, comme un e-mail écrit à la main : texte, signature, coordonnées, lien de désinscription.
 * Sans `unsubscribeUrl` (e-mail lié à une prestation : devis, relance), pas de pied de désinscription.
 */
export function buildMessage({ body, contact, unsubscribeUrl }: { body: string; contact: Contact; unsubscribeUrl?: string }) {
  const links = contactLinks(contact);
  const signature = [contact.name, contact.tagline].filter(Boolean) as string[];
  const footer = "Vous recevez ce message car vous avez utilisé une galerie ALVZ.REC. Ne plus recevoir de messages :";

  const text = [
    body.trim(),
    "",
    "—",
    ...signature,
    ...links.map((l) => `${l.label} : ${l.value} (${l.href})`),
    ...(unsubscribeUrl ? ["", `${footer} ${unsubscribeUrl}`] : []),
  ].join("\n");

  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a">
<div style="max-width:560px">${paragraphs}
<p style="margin:28px 0 4px;color:#555">—</p>
${signature.map((s, i) => `<p style="margin:0;${i === 0 ? "font-weight:600" : "color:#555"}">${escapeHtml(s)}</p>`).join("")}
<p style="margin:12px 0 0">${links.map((l) => `<a href="${escapeHtml(l.href)}" style="color:#1a1a1a">${escapeHtml(l.label)} · ${escapeHtml(l.value)}</a>`).join("<br>")}</p>
${unsubscribeUrl ? `<p style="margin:36px 0 0;font-size:12px;color:#999">${escapeHtml(footer)} <a href="${escapeHtml(unsubscribeUrl)}" style="color:#999">se désinscrire</a></p>` : ""}
</div></body></html>`;
  return { text, html };
}
