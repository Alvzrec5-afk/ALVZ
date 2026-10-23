"use client";

import { useTransition } from "react";
import { createQuote } from "@/app/admin/finance-actions";

const TONE = {
  muted: "bg-bg-soft text-muted",
  accent: "bg-accent/15 text-accent",
  warn: "bg-warn/15 text-warn",
  danger: "bg-danger/15 text-danger",
  ink: "bg-ink text-bg",
} as const;

export function QuoteBadge({ label, tone }: { label: string; tone: keyof typeof TONE }) {
  return <span className={`eyebrow text-[10px] px-3 py-1.5 rounded-full shrink-0 ${TONE[tone]}`}>{label}</span>;
}

/** Crée un brouillon (numéro suivant, réglages par défaut) et ouvre sa fiche. */
export function NewQuoteButton({ galleryId, label = "Nouveau devis", ghost }: { galleryId?: string; label?: string; ghost?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button className={ghost ? "btn btn-ghost" : "btn"} disabled={pending} onClick={() => start(() => createQuote(galleryId))}>
      {pending ? "Création…" : label}
    </button>
  );
}
