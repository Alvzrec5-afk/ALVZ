import { downloadZip } from "client-zip";

type Archive = { zipName: string; totalBytes: number; files: { name: string; size: number; url: string }[] };

type SaveFilePicker = (opts: { suggestedName: string; types?: unknown[] }) => Promise<{
  createWritable: () => Promise<WritableStream>;
}>;

/**
 * Télécharge une collection (ou toute la galerie) en ZIP, assemblé dans le navigateur.
 * Sur ordinateur (Chrome/Edge), le fichier est écrit directement sur le disque au fil de l'eau.
 */
export async function downloadArchive(slug: string, collectionId: string | null, onProgress: (done: number, total: number) => void) {
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  const res = await fetch(`/api/g/${slug}/archive${collectionId ? `?collection=${collectionId}` : ""}`);
  const archive = (await res.json()) as Archive & { error?: string };
  if (!res.ok) throw new Error(archive.error || "Téléchargement impossible");
  if (archive.files.length === 0) return;

  let writable: WritableStream | null = null;
  if (picker) {
    try {
      const handle = await picker({ suggestedName: archive.zipName });
      writable = await handle.createWritable();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // annulé par l'utilisateur
      writable = null; // geste utilisateur expiré : repli sur le téléchargement classique
    }
  }
  if (!writable && archive.totalBytes > 1.5 * 1024 ** 3) {
    const ok = confirm(
      `Cette archive pèse ${(archive.totalBytes / 1024 ** 3).toFixed(1)} Go. Sur téléphone, préférez le téléchargement collection par collection. Continuer ?`,
    );
    if (!ok) return;
  }

  let done = 0;
  onProgress(0, archive.files.length);
  async function* entries() {
    for (const f of archive.files) {
      const r = await fetch(f.url);
      if (!r.ok) throw new Error(`Échec sur ${f.name}`);
      yield { name: f.name, input: r, size: f.size };
      onProgress(++done, archive.files.length);
    }
  }
  const zip = downloadZip(entries());
  if (writable) {
    await zip.body!.pipeTo(writable);
    return;
  }
  const blob = await zip.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = archive.zipName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}
