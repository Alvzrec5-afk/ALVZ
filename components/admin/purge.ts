/** Supprime une galerie ou une collection par lots (voir /api/admin/purge). */
export async function purge(kind: "gallery" | "collection", id: string) {
  for (let i = 0; i < 200; i++) {
    const res = await fetch("/api/admin/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
    if (json.done) return;
  }
  throw new Error("Suppression interrompue, réessayez.");
}
