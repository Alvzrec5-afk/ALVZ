"use client";

import { useState } from "react";

/** Vérifie que le navigateur peut envoyer et relire un fichier sur Oracle (CORS + clés). */
export function StorageCheck() {
  const [state, setState] = useState<"idle" | "running" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function run() {
    setState("running");
    setMessage("");
    try {
      const res = await fetch("/api/admin/storage-test");
      const urls = await res.json();
      if (!res.ok) throw new Error(urls.error || "Le serveur n'a pas pu signer les URL (vérifiez les variables ORACLE_*)");
      const stamp = new Date().toISOString();
      const put = await fetch(urls.put, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: stamp }).catch(() => null);
      if (!put) throw new Error("Envoi bloqué par le navigateur : la règle CORS du bucket Oracle est probablement absente.");
      if (!put.ok) throw new Error(`Oracle a refusé l'envoi (erreur ${put.status}) : vérifiez les clés, le namespace, la région et le nom du bucket.`);
      const get = await fetch(urls.get).catch(() => null);
      if (!get) throw new Error("Lecture bloquée par le navigateur (CORS).");
      if (!get.ok || (await get.text()) !== stamp) throw new Error(`Relecture impossible (erreur ${get.status}).`);
      await fetch("/api/admin/storage-test", { method: "DELETE" });
      setState("ok");
      setMessage("Connexion Oracle opérationnelle : envoi et lecture depuis le navigateur fonctionnent.");
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
      <button onClick={run} disabled={state === "running"} className="btn btn-ghost">
        {state === "running" ? "Vérification…" : "Vérifier le stockage Oracle"}
      </button>
      {message && <p className={`text-sm ${state === "ok" ? "text-ink" : "text-danger"}`}>{message}</p>}
    </div>
  );
}
