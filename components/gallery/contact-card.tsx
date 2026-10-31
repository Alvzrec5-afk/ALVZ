"use client";

import { contactLinks, type Contact } from "@/lib/contact";
import { Wordmark } from "@/components/wordmark";
import { useT } from "./lang";

const ICONS: Record<string, React.ReactNode> = {
  whatsapp: (
    <path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5Zm-3 4.8c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 1.8c.1.2.1.4 0 .6l-.5.7c-.1.2-.2.3 0 .6a6.5 6.5 0 0 0 3 2.7c.3.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.4.4 0 .5-.1 1.1-.7 1.6-.5.5-1.4.8-2.2.7-1-.1-3.3-.9-5-3.1-1.5-1.8-1.7-3.2-1.7-3.8 0-.7.3-1.3.6-1.7Z" />
  ),
  instagram: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="17" cy="7" r="0.6" fill="currentColor" />
    </>
  ),
  tiktok: <path d="M14 4v10.2a3.3 3.3 0 1 1-3.3-3.3M14 4c.4 2.3 1.9 3.8 4.5 4" />,
  email: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  website: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5s1.2-6.1 3.5-8.5Z" />
    </>
  ),
};

/** Carte de visite du studio, en bas de la galerie. */
export function ContactCard({ contact }: { contact: Contact }) {
  const t = useT();
  const links = contactLinks(contact);
  if (links.length === 0) return null;
  return (
    <section className="border-t border-line mt-8 px-6 py-16 sm:py-20 text-center">
      <Wordmark height={52} />
      {contact.name && <p className="gallery-title text-2xl sm:text-3xl mt-8">{contact.name}</p>}
      {contact.tagline && <p className="text-sm text-muted mt-3 max-w-md mx-auto leading-relaxed">{contact.tagline}</p>}
      <p className="eyebrow text-muted mt-10 mb-6">{t("contactMe")}</p>
      <ContactLinks contact={contact} />
    </section>
  );
}

/** Boutons de contact (WhatsApp, Instagram, TikTok, e-mail, site). */
export function ContactLinks({ contact }: { contact: Contact }) {
  const t = useT();
  return (
    <div className="flex flex-wrap justify-center gap-3 max-w-xl mx-auto">
      {contactLinks(contact).map((l) => (
        <a
          key={l.key}
          href={l.href}
          target={l.key === "email" ? undefined : "_blank"}
          rel="noreferrer"
          className="group flex items-center gap-3 border border-line hover:border-ink px-5 py-3.5 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {ICONS[l.key]}
          </svg>
          <span className="text-left">
            <span className="block eyebrow text-[9px] text-muted">{l.key === "email" ? t("emailLabel") : l.key === "website" ? t("websiteLabel") : l.label}</span>
            <span className="block text-sm">{l.value}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

/** Fenêtre « Me contacter » ouverte depuis le bouton en haut de la galerie. */
export function ContactSheet({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-lg bg-bg text-ink px-6 pt-10 pb-[max(env(safe-area-inset-bottom),2rem)] sm:p-12 text-center animate-[fadeUp_0.35s_ease-out_both]"
      >
        <button onClick={onClose} className="icon-btn absolute top-3 right-3" aria-label={t("close")}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <Wordmark height={44} />
        {contact.name && <p className="gallery-title text-2xl mt-6">{contact.name}</p>}
        {contact.tagline && <p className="text-sm text-muted mt-2 leading-relaxed">{contact.tagline}</p>}
        <p className="eyebrow text-muted mt-8 mb-5">{t("contactMe")}</p>
        <ContactLinks contact={contact} />
      </div>
    </div>
  );
}
