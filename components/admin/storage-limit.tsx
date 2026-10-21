"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setStorageLimit } from "@/app/admin/storage-actions";
import { ORACLE_PRICE_PER_GB_MONTH, STORAGE_LIMIT_CHOICES } from "@/lib/storage-limits";

/**
 * Limite des envois, choisie sur l'Accueil : 20 Go = partie gratuite d'Oracle ; plus haut, le compte Oracle doit être
 * en « paiement à l'utilisation » (le surplus est facturé quelques centimes par Go et par mois).
 */
export function StorageLimit({ limitGb, compact = false }: { limitGb: number; compact?: boolean }) {
  const [value, setValue] = useState(limitGb);
  const [error, setError] = useState("");
  // Les limites au-delà des 20 Go gratuits restent cachées tant qu'on ne les demande pas.
  const [more, setMore] = useState(limitGb > 20);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const choices = (STORAGE_LIMIT_CHOICES as readonly number[]).includes(limitGb) ? STORAGE_LIMIT_CHOICES : [...STORAGE_LIMIT_CHOICES, limitGb].sort((a, b) => a - b);
  const extra = Math.max(0, value - 20);

  return (
    <div className={compact ? "flex flex-wrap items-center justify-between gap-2" : "border-x border-b border-line px-4 py-4 sm:px-5 flex flex-wrap items-center justify-between gap-3"}>
      <p className={compact ? "hidden" : "text-xs text-muted max-w-prose"}>
        Limite des envois. Les 20 premiers Go sont gratuits chez Oracle ; au-delà (compte en paiement à l&apos;utilisation),
        environ {ORACLE_PRICE_PER_GB_MONTH.toString().replace(".", ",")} $ par Go et par mois, seulement pour l&apos;espace vraiment utilisé
        {extra > 0 && <> (au plus {(extra * ORACLE_PRICE_PER_GB_MONTH).toFixed(2).replace(".", ",")} $ par mois si les {value} Go sont remplis)</>}.
      </p>
      {!more ? (
        <span className="flex items-center gap-3 text-sm shrink-0">
          Limite : 20 Go (gratuit)
          <button onClick={() => setMore(true)} className="text-xs text-muted underline underline-offset-2 hover:text-ink">
            Augmenter
          </button>
        </span>
      ) : (
      <label className="flex items-center gap-2 text-sm shrink-0">
        Limite
        <select
          value={value}
          disabled={pending}
          onChange={(e) => {
            const gb = Number(e.target.value);
            const before = value;
            setValue(gb);
            setError("");
            startTransition(async () => {
              const res = await setStorageLimit(gb);
              if (!res.ok) {
                setValue(before);
                setError(res.error);
              } else router.refresh();
            });
          }}
          className="bg-transparent border-b border-line text-ink outline-none py-1"
        >
          {choices.map((gb) => (
            <option key={gb} value={gb}>
              {gb} Go{gb === 20 ? " (gratuit)" : ""}
            </option>
          ))}
        </select>
      </label>
      )}
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </div>
  );
}
