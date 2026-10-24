"use client";

import { useState, useTransition } from "react";
import { FRANCHISE_MENTION, type FinanceSettings } from "@/lib/finance";
import { saveFinanceSettings } from "@/app/admin/finance-actions";
import { Segmented } from "@/components/admin/ui";

export function FinanceSettingsForm({ settings }: { settings: FinanceSettings }) {
  const [s, setS] = useState({
    business_name: settings.business_name ?? "",
    owner_name: settings.owner_name ?? "",
    address: settings.address ?? "",
    siret: settings.siret ?? "",
    email: settings.email ?? "",
    phone: settings.phone ?? "",
    vat_mode: settings.vat_mode ?? "franchise",
    vat_rate: String(settings.vat_rate ?? 20),
    iban: settings.iban ?? "",
    bic: settings.bic ?? "",
    payment_link: settings.payment_link ?? "",
    validity_days: String(settings.validity_days ?? 30),
    deposit_pct: String(settings.deposit_pct ?? 30),
    monthly_goal: settings.monthly_goal ? String(settings.monthly_goal) : "",
    terms: settings.terms ?? "",
  });
  const [notice, setNotice] = useState<{ ok?: string; error?: string } | null>(null);
  const [busy, start] = useTransition();
  const set = (k: keyof typeof s) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setS((v) => ({ ...v, [k]: e.target.value }));

  return (
    <div className="max-w-2xl space-y-12">
      <p className="text-sm text-muted leading-relaxed">
        Ces informations apparaissent sur vos devis (mentions obligatoires : nom, adresse, SIRET, mention de TVA). Elles ne sont
        jamais montrées dans les galeries.
      </p>

      <section className="space-y-6">
        <h2 className="eyebrow text-muted">Votre activité</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <F label="Nom commercial"><input className="field" placeholder="ALVZ.REC" value={s.business_name} onChange={set("business_name")} /></F>
          <F label="Votre nom (entrepreneur)"><input className="field" value={s.owner_name} onChange={set("owner_name")} /></F>
          <F label="SIRET"><input className="field" inputMode="numeric" value={s.siret} onChange={set("siret")} /></F>
          <F label="Téléphone"><input className="field" value={s.phone} onChange={set("phone")} /></F>
        </div>
        <F label="E-mail (réponses des clients)"><input className="field" type="email" value={s.email} onChange={set("email")} /></F>
        <F label="Adresse"><textarea className="field" rows={2} value={s.address} onChange={set("address")} /></F>
      </section>

      <section className="space-y-6">
        <h2 className="eyebrow text-muted">TVA</h2>
        <Segmented value={s.vat_mode} options={{ franchise: "Pas de TVA (micro)", vat: "Je facture la TVA" }} onChange={(v) => setS((x) => ({ ...x, vat_mode: v }))} />
        {s.vat_mode === "franchise" ? (
          <p className="text-xs text-muted">Vos devis afficheront « {FRANCHISE_MENTION} ».</p>
        ) : (
          <F label="Taux habituel (%)"><input className="field" inputMode="decimal" value={s.vat_rate} onChange={set("vat_rate")} /></F>
        )}
      </section>

      <section className="space-y-6">
        <h2 className="eyebrow text-muted">Paiement</h2>
        <div className="grid sm:grid-cols-[1fr_10rem] gap-6">
          <F label="IBAN (affiché sur le devis pour les virements)"><input className="field" value={s.iban} onChange={set("iban")} /></F>
          <F label="BIC"><input className="field" value={s.bic} onChange={set("bic")} /></F>
          <div className="sm:col-span-2">
            <F label="Lien de paiement en ligne (Revolut, PayPal, Lydia…)">
              <input className="field" inputMode="url" placeholder="https://revolut.me/votre-nom" value={s.payment_link} onChange={set("payment_link")} />
            </F>
            <p className="text-xs text-muted mt-2">Ajoute un bouton « Payer » sur vos devis et le lien dans les e-mails. Un devis peut avoir son propre lien.</p>
          </div>
          <F label="Acompte habituel (%)"><input className="field" inputMode="numeric" value={s.deposit_pct} onChange={set("deposit_pct")} /></F>
          <F label="Objectif par mois (€, Accueil)"><input className="field" inputMode="numeric" placeholder="Ex. 3000" value={s.monthly_goal} onChange={set("monthly_goal")} /></F>
          <F label="Devis valable (jours)"><input className="field" inputMode="numeric" value={s.validity_days} onChange={set("validity_days")} /></F>
        </div>
        <F label="Conditions habituelles (en bas de chaque devis)">
          <textarea
            className="field leading-relaxed"
            rows={4}
            placeholder="Ex. Acompte non remboursable en cas d'annulation moins de 30 jours avant. Photos livrées sous 4 semaines."
            value={s.terms}
            onChange={set("terms")}
          />
        </F>
      </section>

      <div className="flex items-center gap-4">
        <button
          className="btn"
          disabled={busy}
          onClick={() => start(async () => setNotice(await saveFinanceSettings(s)))}
        >
          {busy ? "…" : "Enregistrer"}
        </button>
        {notice?.ok && <span className="text-sm text-accent">{notice.ok} ✓</span>}
        {notice?.error && <span className="text-sm text-danger">{notice.error}</span>}
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
