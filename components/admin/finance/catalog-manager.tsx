"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { UNITS, formatCents, parseEuros, type CatalogItem } from "@/lib/finance";
import { archiveCatalogItem, deleteCatalogItem, saveCatalogItem } from "@/app/admin/finance-actions";
import { PlusIcon } from "@/components/icons";

type Draft = { name: string; reference: string; description: string; unit: string; price: string; kind: "service" | "debours" };

const toDraft = (c?: CatalogItem): Draft => ({
  name: c?.name ?? "",
  reference: c?.reference ?? "",
  description: c?.description ?? "",
  unit: c?.unit ?? "Forfait",
  price: c ? (c.price_cents / 100).toFixed(2).replace(".", ",") : "",
  kind: c?.kind ?? "service",
});

/** Catalogue d'articles (repris d'Abby) : recherche, modification sur place, ajout, archive. */
export function CatalogManager({ items }: { items: CatalogItem[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null); // id de l'article ouvert, ou « new »
  const [showArchived, setShowArchived] = useState(false);
  const active = items.filter((c) => !c.archived);
  const archived = items.filter((c) => c.archived);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? active.filter((c) => `${c.name} ${c.reference} ${c.description}`.toLowerCase().includes(q)) : active;
  }, [active, query]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <p className="text-sm text-muted flex-1 min-w-48">
          Vos prestations et leurs prix. Dans un devis, « Ajouter un article » remplit la ligne en un clic.
        </p>
        <button className="btn" onClick={() => setOpen("new")}>
          <PlusIcon className="w-4 h-4" /> Nouvel article
        </button>
      </div>

      {open === "new" && <Editor onDone={() => setOpen(null)} />}

      {active.length > 8 && <input className="field mb-2" placeholder="Rechercher un article…" value={query} onChange={(e) => setQuery(e.target.value)} />}

      <ul>
        {shown.map((c) => (
          <li key={c.id} className="border-b border-line">
            {open === c.id ? (
              <Editor item={c} onDone={() => setOpen(null)} />
            ) : (
              <button className="w-full flex items-start gap-4 py-4 text-left hover:opacity-80" onClick={() => setOpen(c.id)}>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px]">{c.name}</span>
                  <span className="block text-xs text-muted mt-0.5 line-clamp-2">
                    {[c.reference, c.description].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-sm tabular-nums">{formatCents(c.price_cents)}</span>
                  <span className="block text-[11px] text-muted">{c.kind === "debours" ? "débours · " : ""}{c.unit.toLowerCase()}</span>
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="py-10 text-center text-sm text-muted">Aucun article{query ? " ne correspond" : " pour l'instant"}.</p>}

      {archived.length > 0 && (
        <div className="mt-10">
          <button className="text-xs text-muted hover:text-ink" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "Masquer" : "Voir"} les articles archivés ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-3 opacity-70">
              {archived.map((c) => (
                <li key={c.id} className="border-b border-line">
                  {open === c.id ? (
                    <Editor item={c} onDone={() => setOpen(null)} />
                  ) : (
                    <button className="w-full flex items-center gap-4 py-3 text-left text-sm" onClick={() => setOpen(c.id)}>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="tabular-nums">{formatCents(c.price_cents)}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Editor({ item, onDone }: { item?: CatalogItem; onDone: () => void }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(() => toDraft(item));
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setD((v) => ({ ...v, [k]: e.target.value }));

  function save() {
    const cents = d.price.trim() === "" ? 0 : parseEuros(d.price);
    if (cents === null || cents < 0) return setError("Prix invalide.");
    start(async () => {
      const r = await saveCatalogItem(item?.id ?? null, { ...d, price_cents: cents });
      if (r.error) return setError(r.error);
      router.refresh();
      onDone();
    });
  }
  function run(fn: () => Promise<{ error?: string }>) {
    start(async () => {
      const r = await fn();
      if (r.error) return setError(r.error);
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="py-6 px-4 -mx-4 bg-bg-soft space-y-5 mb-2">
      <div className="grid sm:grid-cols-[1fr_12rem] gap-5">
        <label className="block">
          <span className="label">Nom de l&apos;article</span>
          <input className="field" autoFocus={!item} value={d.name} onChange={set("name")} maxLength={200} />
        </label>
        <label className="block">
          <span className="label">Référence</span>
          <input className="field" placeholder="Ex. PHOTO-MARIAGE-01" value={d.reference} onChange={set("reference")} maxLength={60} />
        </label>
      </div>
      <label className="block">
        <span className="label">Description (affichée sous le nom dans le devis)</span>
        <textarea className="field" rows={2} value={d.description} onChange={set("description")} maxLength={1000} />
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
        <label className="block">
          <span className="label">Prix unitaire (€)</span>
          <input className="field" inputMode="decimal" placeholder="0,00" value={d.price} onChange={set("price")} onKeyDown={(e) => e.key === "Enter" && save()} />
        </label>
        <label className="block">
          <span className="label">Unité</span>
          <select className="field" value={d.unit} onChange={set("unit")}>
            {[...new Set([...UNITS, d.unit])].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="block col-span-2 sm:col-span-1">
          <span className="label">Type</span>
          <select className="field" value={d.kind} onChange={set("kind")}>
            <option value="service">Prestation</option>
            <option value="debours">Débours (frais refacturés)</option>
          </select>
        </label>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" onClick={save} disabled={busy}>{busy ? "…" : item ? "Enregistrer" : "Ajouter"}</button>
        <button className="btn btn-ghost" onClick={onDone} disabled={busy}>Annuler</button>
        {item && (
          <span className="ml-auto flex gap-4 text-xs">
            <button className="text-muted hover:text-ink" disabled={busy} onClick={() => run(() => archiveCatalogItem(item.id, !item.archived))}>
              {item.archived ? "Remettre dans le catalogue" : "Archiver"}
            </button>
            <button
              className="text-danger"
              disabled={busy}
              onClick={() => {
                if (confirm(`Supprimer « ${item.name} » ? Les devis déjà faits ne changent pas.`)) run(() => deleteCatalogItem(item.id));
              }}
            >
              Supprimer
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
