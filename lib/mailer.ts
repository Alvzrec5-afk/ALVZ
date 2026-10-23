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

export type MailButton = { label: string; href: string };

/** Bouton noir (tableau : rendu fidèle dans Gmail, Outlook, Apple Mail). */
function buttonHtml(b: MailButton) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr><td style="background:#161514;border-radius:2px">
<a href="${escapeHtml(b.href)}" style="display:inline-block;padding:14px 26px;color:#ffffff;text-decoration:none;font-size:13px;letter-spacing:.14em;text-transform:uppercase">${escapeHtml(b.label)}</a>
</td></tr></table>`;
}

/**
 * Message sobre, comme un e-mail écrit à la main : texte, signature (logo rond + icônes des réseaux), lien de désinscription.
 * Sans `unsubscribeUrl` (e-mail lié à une prestation : devis, relance), pas de pied de désinscription.
 * `buttons` : un repère (ex. « {lien} ») seul sur sa ligne devient un bouton ; ailleurs, un lien ; dans le texte brut, l'adresse.
 * `origin` : adresse du site, pour les images de la signature.
 */
export function buildMessage({
  body,
  contact,
  unsubscribeUrl,
  buttons = {},
  origin,
}: {
  body: string;
  contact: Contact;
  unsubscribeUrl?: string;
  buttons?: Record<string, MailButton>;
  origin?: string;
}) {
  const links = contactLinks(contact);
  const signature = [contact.name, contact.tagline].filter(Boolean) as string[];
  const footer = "Vous recevez ce message car vous avez utilisé une galerie ALVZ.REC. Ne plus recevoir de messages :";
  const tokens = Object.keys(buttons);

  let plain = body.trim();
  for (const t of tokens) plain = plain.replaceAll(t, buttons[t].href);
  const text = [
    plain,
    "",
    "—",
    ...signature,
    ...links.map((l) => `${l.label} : ${l.value} (${l.href})`),
    ...(unsubscribeUrl ? ["", `${footer} ${unsubscribeUrl}`] : []),
  ].join("\n");

  const line = (l: string) => {
    const alone = tokens.find((t) => l.trim() === t);
    if (alone) return { button: buttonHtml(buttons[alone]) };
    let html = escapeHtml(l);
    for (const t of tokens) html = html.replaceAll(escapeHtml(t), `<a href="${escapeHtml(buttons[t].href)}" style="color:#1a1a1a">${escapeHtml(buttons[t].label)}</a>`);
    return { html };
  };
  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map((p) => {
      let out = "";
      let current: string[] = [];
      const flush = () => {
        if (current.length) out += `<p style="margin:0 0 16px">${current.join("<br>")}</p>`;
        current = [];
      };
      for (const l of p.split("\n")) {
        const r = line(l);
        if ("button" in r) {
          flush();
          out += r.button;
        } else current.push(r.html);
      }
      flush();
      return out;
    })
    .join("");

  const img = (file: string) => (origin ? `${origin}/brand/mail/${file}` : null);
  const avatar = img("avatar.png");
  const icons = links
    .map((l) => {
      const src = img(`${l.key}.png`);
      return src
        ? `<a href="${escapeHtml(l.href)}" style="text-decoration:none;margin-right:8px"><img src="${src}" width="28" height="28" alt="${escapeHtml(l.label)}" title="${escapeHtml(`${l.label} · ${l.value}`)}" style="display:inline-block;border:0;vertical-align:middle"></a>`
        : `<a href="${escapeHtml(l.href)}" style="color:#1a1a1a;margin-right:10px">${escapeHtml(l.label)}</a>`;
    })
    .join("");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a">
<div style="max-width:560px">${paragraphs}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #e6e2dc;padding-top:20px"><tr>
${avatar ? `<td style="padding:20px 16px 0 0;vertical-align:middle"><img src="${avatar}" width="64" height="64" alt="ALVZ.REC" style="display:block;border:0;border-radius:50%"></td>` : ""}
<td style="padding-top:20px;vertical-align:middle">
${signature.map((s, i) => `<div style="${i === 0 ? "font-weight:600" : "color:#555;font-size:14px"}">${escapeHtml(s)}</div>`).join("")}
${icons ? `<div style="margin-top:10px;line-height:0">${icons}</div>` : ""}
</td></tr></table>
${unsubscribeUrl ? `<p style="margin:36px 0 0;font-size:12px;color:#999">${escapeHtml(footer)} <a href="${escapeHtml(unsubscribeUrl)}" style="color:#999">se désinscrire</a></p>` : ""}
</div></body></html>`;
  return { text, html };
}
