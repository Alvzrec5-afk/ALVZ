import {
  FRANCHISE_MENTION,
  depositCents,
  discountText,
  quoteDiscount,
  formatCents,
  lineTotal,
  quoteState,
  quoteTotals,
  type FinanceSettings,
  type Quote,
} from "@/lib/finance";
import { Wordmark } from "@/components/wordmark";

const day = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");

/**
 * Le devis en PDF (« Enregistrer en PDF » = impression du navigateur) : une page A4 bien rangée,
 * tailles fixes en points, tableau à en-tête noir. Invisible à l'écran.
 */
export function QuotePrint({ q, paid, f }: { q: Quote; paid: number; f: FinanceSettings }) {
  const discount = quoteDiscount(q);
  const totals = quoteTotals(q.lines, q.vat_rate, discount);
  const state = quoteState(q, paid);
  const deposit = depositCents(q);
  const franchise = q.vat_rate === 0;
  const terms = q.notes || f.terms;
  const ht = franchise ? "" : " HT";
  const badge = q.status === "accepted" ? (state.settled ? "PAYÉ" : "SIGNÉ") : null;
  const owner = [
    f.owner_name && <b key="o">{f.owner_name}{f.business_name && f.owner_name !== f.business_name ? " EI" : ""}</b>,
    f.business_name && f.business_name !== f.owner_name ? f.business_name : null,
    f.email,
    f.phone,
    f.address,
    f.siret && `N° SIRET : ${f.siret}`,
  ].filter(Boolean);

  return (
    <div className="quote-print hidden print:block text-black" style={{ fontSize: "10pt", lineHeight: 1.4 }}>
      <header className="flex items-start justify-between gap-8">
        <Wordmark height={52} tone="dark" />
        <div className="text-right">
          <p style={{ fontSize: "24pt", fontWeight: 700, lineHeight: 1.1 }}>Devis</p>
          <p className="mt-1 flex items-center justify-end gap-2" style={{ fontSize: "15pt", fontWeight: 600, color: "#4b5563" }}>
            {q.number}
            {badge && (
              <span style={{ fontSize: "7pt", fontWeight: 700, letterSpacing: "0.06em", color: "#15803d", background: "#dcfce7", padding: "1pt 5pt" }}>{badge}</span>
            )}
          </p>
        </div>
      </header>

      <div className="flex justify-between gap-10" style={{ marginTop: "16pt" }}>
        <div>
          <div className="whitespace-pre-line">
            {owner.map((x, i) => (
              <div key={i}>{x}</div>
            ))}
          </div>
          <table style={{ marginTop: "10pt", fontSize: "10.5pt" }}>
            <tbody>
              <tr>
                <td style={{ color: "#4b5563", fontWeight: 600, paddingRight: "12pt" }}>Date d&apos;émission</td>
                <td style={{ fontWeight: 600 }}>{day(q.issued_on)}</td>
              </tr>
              {q.valid_until && (
                <tr>
                  <td style={{ color: "#4b5563", fontWeight: 600, paddingRight: "12pt" }}>Date de validité</td>
                  <td style={{ fontWeight: 600 }}>{day(q.valid_until)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="text-right" style={{ paddingTop: "18pt", maxWidth: "45%" }}>
          <p style={{ fontWeight: 700 }}>{q.client_name}</p>
          {q.client_address && <p className="whitespace-pre-line">{q.client_address}</p>}
          {q.client_email && <p>{q.client_email}</p>}
          {q.client_phone && <p>{q.client_phone}</p>}
        </div>
      </div>

      {q.title && (
        <p style={{ marginTop: "14pt" }}>
          <span style={{ color: "#4b5563", fontWeight: 600 }}>Objet : </span>
          {q.title}
        </p>
      )}

      <table className="w-full" style={{ marginTop: "12pt", borderCollapse: "collapse" }}>
        <thead>
          <tr className="qp-head">
            <th style={{ width: "22pt" }}>#</th>
            <th className="text-left">Désignation et description</th>
            <th style={{ width: "52pt" }}>Unité</th>
            <th style={{ width: "50pt" }}>Quantité</th>
            <th style={{ width: "76pt" }} className="text-right">Prix unitaire</th>
            <th style={{ width: "70pt" }} className="text-right">Montant{ht}</th>
          </tr>
        </thead>
        <tbody>
          {q.lines.map((l, i) => (
            <tr key={i} className="qp-row" style={{ background: i % 2 ? "#f4f4f5" : undefined }}>
              <td className="text-center" style={{ color: "#6b7280" }}>{i + 1}</td>
              <td>
                <span className="block whitespace-pre-line" style={{ fontWeight: 600, fontSize: "10.5pt" }}>{l.label}</span>
                {l.description && <span className="block whitespace-pre-line" style={{ fontSize: "8pt", color: "#6b7280", marginTop: "1pt" }}>{l.description}</span>}
              </td>
              <td className="text-center">{l.unit ?? ""}</td>
              <td className="text-center tabular-nums">{String(l.qty).replace(".", ",")}</td>
              <td className="text-right tabular-nums whitespace-nowrap">{formatCents(l.unit_cents)}</td>
              <td className="text-right tabular-nums whitespace-nowrap">{formatCents(lineTotal(l))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="qp-keep flex justify-between gap-10" style={{ marginTop: "16pt" }}>
        <div className="flex-1">
          <p style={{ fontSize: "13pt", fontWeight: 700 }}>Conditions de paiement</p>
          {deposit > 0 && (
            <>
              <p style={{ fontWeight: 700, marginTop: "6pt" }}>Acompte à la commande</p>
              <p>{q.deposit_pct} %, soit {formatCents(deposit)}</p>
            </>
          )}
          <p style={{ fontWeight: 700, marginTop: "6pt" }}>Délai de paiement</p>
          <p>{q.due_on ? `Solde avant le ${day(q.due_on)}` : "À la réception"}</p>
          {f.iban && (
            <>
              <p style={{ fontWeight: 700, marginTop: "6pt" }}>Virement</p>
              <p>IBAN {f.iban}</p>
              {f.bic && <p>BIC {f.bic}</p>}
            </>
          )}
        </div>
        <div style={{ width: "46%" }}>
          <div className="space-y-1">
            {totals.discount > 0 && (
              <>
                <Row label={`Sous-total${ht}`} value={formatCents(totals.gross)} />
                <Row label={discountText(discount)} value={`− ${formatCents(totals.discount)}`} />
              </>
            )}
            {!franchise && (
              <>
                <Row label="Total HT" value={formatCents(totals.ht)} />
                <Row label={`TVA ${String(q.vat_rate).replace(".", ",")} %`} value={formatCents(totals.vat)} />
              </>
            )}
          </div>
          <div className="qp-total flex justify-between" style={{ marginTop: "6pt" }}>
            <span>{franchise ? "Total" : "Total TTC"}</span>
            <span className="tabular-nums">{formatCents(q.total_cents)}</span>
          </div>
          {franchise && <p style={{ fontSize: "8.5pt", marginTop: "6pt" }}>{FRANCHISE_MENTION}</p>}
          {paid > 0 && (
            <div className="space-y-1" style={{ marginTop: "6pt" }}>
              <Row label="Déjà réglé" value={formatCents(paid)} />
              <Row label="Reste à payer" value={formatCents(state.remaining)} strong />
            </div>
          )}
        </div>
      </div>

      {terms && (
        <p className="qp-keep whitespace-pre-line" style={{ marginTop: "16pt", fontSize: "8.5pt", color: "#4b5563" }}>
          {terms}
        </p>
      )}
      {q.status === "accepted" && q.accepted_name && (
        <p className="qp-keep" style={{ marginTop: "10pt", fontSize: "9pt" }}>
          <b>Bon pour accord</b> — {q.accepted_name}
          {q.accepted_at ? `, le ${day(q.accepted_at)}` : ""} (accepté en ligne).
        </p>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4" style={{ fontWeight: strong ? 700 : undefined, padding: "0 6pt" }}>
      <span>{label}</span>
      <span className="tabular-nums whitespace-nowrap">{value}</span>
    </div>
  );
}
