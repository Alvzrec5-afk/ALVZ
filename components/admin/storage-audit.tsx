"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatBytes } from "@/lib/format";
import type { StorageAuditResult } from "@/lib/storage-audit";

/**
 * Espace réellement occupé chez Oracle (le compteur du studio ne voit que les fichiers qu'il connaît) et nettoyage
 * des fichiers orphelins / envois interrompus.
 */
export function StorageAudit() {
  const [state, setState] = useState<"idle" | "running" | "cleaning">("idle");
  const [audit, setAudit] = useState<StorageAuditResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function analyse(keepMessage = false) {
    setState("running");
    setError("");
    if (!keepMessage) setMessage("");
    try {
      const res = await fetch("/api/admin/storage-audit", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setAudit(json as StorageAuditResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setState("idle");
    }
  }

  async function clean() {
    if (!audit) return;
    if (!confirm(`Supprimer définitivement ${audit.freeable.count} fichier(s) que plus rien n'utilise (${formatBytes(audit.freeable.bytes)}) ?`)) return;
    setState("cleaning");
    setError("");
    try {
      const res = await fetch("/api/admin/storage-audit", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setMessage(`${formatBytes(json.freed)} libérés (${json.files} fichier(s), ${json.uploads} envoi(s) interrompu(s)).`);
      setState("idle");
      router.refresh(); // la jauge relit l'espace réel
      await analyse(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("idle");
    }
  }

  return (
    <div className="border-x border-b border-line px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted max-w-prose">
          Le compteur ci-dessus additionne les fichiers connus du studio. L&apos;analyse compte tout ce qu&apos;Oracle facture
          réellement, y compris les fichiers oubliés.
        </p>
        <button onClick={() => analyse()} disabled={state !== "idle"} className="btn btn-ghost">
          {state === "running" ? "Analyse…" : audit ? "Relancer l'analyse" : "Analyser l'espace réel chez Oracle"}
        </button>
      </div>
      {audit && (
        <div className="mt-4 text-sm">
          <p>
            Chez Oracle : <strong>{formatBytes(audit.total)}</strong>{" "}
            <span className="text-muted">dont {formatBytes(audit.tracked)} utilisés par le studio</span>
          </p>
          <ul className="mt-2 space-y-1 text-muted">
            <li>
              Fichiers orphelins (plus rien ne les utilise) : {formatBytes(audit.orphans.bytes)} · {audit.orphans.count} fichier(s)
            </li>
            <li>
              Envois interrompus : {formatBytes(audit.uploads.bytes)} · {audit.uploads.count}
            </li>
            {audit.other.count > 0 && (
              <li title={audit.other.examples.join("\n")}>
                Autres fichiers (gardés par prudence) : {formatBytes(audit.other.bytes)} · {audit.other.count}
              </li>
            )}
          </ul>
          {audit.freeable.count > 0 ? (
            <button onClick={clean} disabled={state !== "idle"} className="btn mt-4">
              {state === "cleaning" ? "Nettoyage…" : `Libérer ${formatBytes(audit.freeable.bytes)}`}
            </button>
          ) : (
            <p className="mt-3 text-muted">Rien à nettoyer.</p>
          )}
        </div>
      )}
      {message && <p className="mt-3 text-sm text-accent">{message}</p>}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
