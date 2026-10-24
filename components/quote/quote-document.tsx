import {
  FRANCHISE_MENTION,
  amountDueNow,
  depositCents,
  discountText,
  quoteDiscount,
  formatCents,
  formatDay,
  lineTotal,
  qtyWithUnit,
  quoteState,
  quoteTotals,
  type FinanceSettings,
  type Quote,
} from "@/lib/finance";
import { Wordmark } from "@/components/wordmark";
import { AcceptForm } from "./accept-form";
import { PrintButton } from "./print-button";

/** Devis tel que le client le voit : lecture, PDF (impression du navigateur), bon pour accord. */
export function QuoteDocument({ q, paid, f, slug }: { q: Quote; paid: number; f: FinanceSettings; slug: string }) {
  const discount = quoteDiscount(q);
  const totals = quoteTotals(q.lines, q.vat_rate, discount);
  const state = quoteState(q, paid);
  const deposit = depositCents(q);
  const franchise = q.vat_rate === 0;
  const canAccept = q.status === "sent" && !state.expired;
  const terms = q.notes || f.terms;
  const payLink = q.payment_link || f.payment_link || "";
  const due = amountDueNow(q, paid);
  const canPay = Boolean(payLink) && (q.status === "sent" || q.status === "accepted") && due.cents > 0;

  return (
    <div data-theme="blanc" className="min-h-svh bg-bg-soft text-ink print:bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-14 print:p-0 print:max-w-none">
        <div className="no-print flex flex-wrap items-center justify-end gap-3 mb-6">
          {q.status === "accepted" && <span className="text-sm text-accent mr-auto">✓ Devis accepté{q.accepted_at ? ` le ${formatDay(q.accepted_at.slice(0, 10))}` : ""}</span>}
          {state.settled && <span className="text-sm text-accent mr-auto">✓ Réglé, merci !</span>}
          <PrintButton />
        </div>

        <article className="bg-bg border border-line px-6 sm:px-12 py-10 sm:py-14 print:border-0 print:px-0 print:py-0">
          <header className="flex flex-wrap items-start justify-between gap-8">
            <div>
              <Wordmark height={34} tone="dark" />
              <div className="text-xs text-muted mt-5 leading-relaxed whitespace-pre-line">
                {[f.business_name, f.owner_name && f.owner_name !== f.business_name ? `${f.owner_name}, entrepreneur individuel` : null, f.address, f.siret && `SIRET ${f.siret}`, f.email, f.phone]
                  .filter(Boolean)
                  .join("\n")}
              </div>
            </div>
            <div className="text-right">
              <p className="display text-4xl">Devis</p>
              <p className="text-sm mt-2">N° {q.number}</p>
              <p className="text-xs text-muted mt-1">Du {formatDay(q.issued_on)}</p>
              {q.valid_until && <p className="text-xs text-muted">Valable jusqu&apos;au {formatDay(q.valid_until)}</p>}
            </div>
          </header>

          <div className="mt-12 grid sm:grid-cols-2 gap-8">
            <div>
              <p className="label">Client</p>
              <p className="text-[15px] mt-1">{q.client_name}</p>
              {q.client_address && <p className="text-sm text-muted whitespace-pre-line">{q.client_address}</p>}
              {q.client_email && <p className="text-sm text-muted">{q.client_email}</p>}
            </div>
            {q.title && (
              <div>
                <p className="label">Objet</p>
                <p className="text-[15px] mt-1">{q.title}</p>
              </div>
            )}
          </div>

          <table className="w-full mt-12 text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-ink">
                <th className="py-2 font-normal">Description</th>
                <th className="py-2 font-normal text-right w-20">Qté</th>
                <th className="py-2 font-normal text-right w-28 hidden sm:table-cell print:table-cell">Prix unitaire{franchise ? "" : " HT"}</th>
                <th className="py-2 font-normal text-right w-28">Total{franchise ? "" : " HT"}</th>
              </tr>
            </thead>
            <tbody>
              {q.lines.map((l, i) => (
                <tr key={i} className="border-b border-line align-top">
                  <td className="py-3 pr-4">
                    <span className="block whitespace-pre-line">{l.label}</span>
                    {l.description && <span className="block text-xs text-muted mt-1 leading-relaxed whitespace-pre-line">{l.description}</span>}
                  </td>
                  <td className="py-3 text-right tabular-nums whitespace-nowrap">{qtyWithUnit(l.qty, l.unit)}</td>
                  <td className="py-3 text-right tabular-nums hidden sm:table-cell print:table-cell">{formatCents(l.unit_cents)}</td>
                  <td className="py-3 text-right tabular-nums">{formatCents(lineTotal(l))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="mt-6 ml-auto max-w-xs text-sm space-y-2">
            {totals.discount > 0 && (
              <>
                <div className="flex justify-between"><dt className="text-muted">Sous-total{franchise ? "" : " HT"}</dt><dd className="tabular-nums">{formatCents(totals.gross)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">{discountText(discount)}</dt><dd className="tabular-nums whitespace-nowrap">− {formatCents(totals.discount)}</dd></div>
              </>
            )}
            {!franchise && (
              <>
                <div className="flex justify-between"><dt className="text-muted">Total HT</dt><dd className="tabular-nums">{formatCents(totals.ht)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">TVA {String(q.vat_rate).replace(".", ",")} %</dt><dd className="tabular-nums">{formatCents(totals.vat)}</dd></div>
              </>
            )}
            <div className="flex justify-between text-base font-medium border-t border-ink pt-2">
              <dt>{franchise ? "Total" : "Total TTC"}</dt>
              <dd className="tabular-nums">{formatCents(q.total_cents)}</dd>
            </div>
            {franchise && <p className="text-xs text-muted text-right">{FRANCHISE_MENTION}</p>}
            {deposit > 0 && (
              <div className="flex justify-between text-muted"><dt>Acompte à la commande ({q.deposit_pct} %)</dt><dd className="tabular-nums">{formatCents(deposit)}</dd></div>
            )}
            {paid > 0 && (
              <>
                <div className="flex justify-between text-muted"><dt>Déjà réglé</dt><dd className="tabular-nums">{formatCents(paid)}</dd></div>
                <div className="flex justify-between font-medium"><dt>Reste à payer</dt><dd className="tabular-nums">{formatCents(state.remaining)}</dd></div>
              </>
            )}
          </dl>

          <div className="mt-12 space-y-6 text-xs text-muted leading-relaxed">
            {q.due_on && <p>Solde à régler avant le {formatDay(q.due_on)}.</p>}
            {f.iban && (
              <p>
                Règlement par virement : IBAN <span className="text-ink">{f.iban}</span>
                {f.bic ? <> · BIC <span className="text-ink">{f.bic}</span></> : null}
                {f.business_name || f.owner_name ? ` · titulaire ${f.owner_name || f.business_name}` : ""}.
              </p>
            )}
            {terms && <p className="whitespace-pre-line">{terms}</p>}
            {q.status === "accepted" && q.accepted_name && (
              <p className="text-ink">Bon pour accord — {q.accepted_name}{q.accepted_at ? `, le ${formatDay(q.accepted_at.slice(0, 10))}` : ""} (accepté en ligne).</p>
            )}
          </div>
        </article>

        {canPay && (
          <section className="no-print mt-8 bg-bg border border-line px-6 sm:px-12 py-8 flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex-1 min-w-48">
              <p className="display text-2xl">{due.label === "Payer l'acompte" ? "Acompte à régler" : "Reste à régler"}</p>
              <p className="text-sm text-muted mt-1 tabular-nums">{formatCents(due.cents)}</p>
            </div>
            <a href={`/d/${slug}/pay`} target="_blank" rel="noopener noreferrer nofollow" className="btn w-full sm:w-auto">
              {due.label}
            </a>
          </section>
        )}
        {canAccept && (
          <section className="no-print mt-8 bg-bg border border-line px-6 sm:px-12 py-10">
            <h2 className="display text-2xl mb-6">Accepter le devis</h2>
            <AcceptForm slug={slug} />
          </section>
        )}
        {q.status === "sent" && state.expired && (
          <p className="no-print mt-8 text-sm text-warn">Ce devis a expiré le {formatDay(q.valid_until)}. Contactez-moi pour le mettre à jour.</p>
        )}
        {(q.status === "refused" || q.status === "cancelled") && <p className="no-print mt-8 text-sm text-muted">Ce devis n&apos;est plus valable.</p>}
      </div>
    </div>
  );
}
