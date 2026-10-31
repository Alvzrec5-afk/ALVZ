/**
 * File d'analyse des visages du studio : une photo à la fois, en arrière-plan (même en changeant de page
 * dans le studio). Photos qui viennent d'être envoyées : l'original encore sur l'ordinateur sert directement.
 * Galeries déjà en ligne : l'original est relu chez Oracle.
 */
import { facesInImage } from "./faces";

type Job = { galleryId: string; photoId: string; file?: File; urls?: string[] };
export type FaceIndexState = { running: boolean; done: number; total: number; error: string | null };

const IDLE: FaceIndexState = { running: false, done: 0, total: 0, error: null };

class FaceIndexer {
  private queue: Job[] = [];
  private enabled = new Map<string, Promise<boolean>>();
  private listeners = new Set<() => void>();
  private state: FaceIndexState = IDLE;
  private busy = false;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.state;
  getServerSnapshot = () => IDLE;

  private set(patch: Partial<FaceIndexState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** La recherche par visage est-elle activée pour cette galerie ? (demandé une fois) */
  private isEnabled(galleryId: string) {
    let p = this.enabled.get(galleryId);
    if (!p) {
      p = fetch(`/api/admin/faces?gallery=${galleryId}&count=1`)
        .then((r) => r.json())
        .then((j) => Boolean(j.enabled))
        .catch(() => false);
      this.enabled.set(galleryId, p);
    }
    return p;
  }

  /** L'option vient d'être activée ou désactivée dans les paramètres. */
  setEnabled(galleryId: string, on: boolean) {
    this.enabled.set(galleryId, Promise.resolve(on));
  }

  /** Photo qui vient d'être envoyée (appelé par la file d'envoi). */
  async addUploaded(galleryId: string, photoId: string, file: File) {
    if (!(await this.isEnabled(galleryId))) return;
    this.push([{ galleryId, photoId, file }]);
  }

  /** Toutes les photos pas encore analysées d'une galerie (bouton « Analyser les visages »). */
  async analyzeGallery(galleryId: string) {
    this.setEnabled(galleryId, true);
    const res = await fetch(`/api/admin/faces?gallery=${galleryId}`);
    const json = (await res.json().catch(() => ({}))) as { pending?: { id: string; urls: string[] }[]; error?: string };
    if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
    const known = new Set(this.queue.map((j) => j.photoId));
    this.push((json.pending ?? []).filter((p) => !known.has(p.id)).map((p) => ({ galleryId, photoId: p.id, urls: p.urls })));
  }

  private push(jobs: Job[]) {
    if (!jobs.length) return;
    this.queue.push(...jobs);
    const fresh = !this.state.running;
    this.set({ running: true, total: (fresh ? 0 : this.state.total) + jobs.length, done: fresh ? 0 : this.state.done, error: null });
    void this.run();
  }

  private async source(job: Job): Promise<ImageBitmap> {
    if (job.file) return createImageBitmap(job.file, { imageOrientation: "from-image" });
    let last: unknown;
    // Original d'abord ; si le navigateur ne sait pas le lire (ex. HEIC), la version web 2000 px.
    for (const url of job.urls ?? []) {
      try {
        const blob = await (await fetch(url)).blob();
        return await createImageBitmap(blob, { imageOrientation: "from-image" });
      } catch (e) {
        last = e;
      }
    }
    throw last instanceof Error ? last : new Error("Image illisible");
  }

  private async run() {
    if (this.busy) return;
    this.busy = true;
    try {
      for (let job = this.queue.shift(); job; job = this.queue.shift()) {
        let faces: Awaited<ReturnType<typeof facesInImage>> = [];
        try {
          const bitmap = await this.source(job);
          faces = await facesInImage(bitmap, bitmap.width, bitmap.height);
          bitmap.close();
        } catch (e) {
          // Photo illisible : notée comme analysée (sans visage) pour ne pas bloquer la file.
          console.warn("Analyse des visages impossible", job.photoId, e);
        }
        try {
          const res = await fetch("/api/admin/faces", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photoId: job.photoId, faces }),
          });
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Erreur ${res.status}`);
        } catch (e) {
          this.set({ error: e instanceof Error ? e.message : String(e) });
        }
        this.set({ done: this.state.done + 1 });
      }
    } finally {
      this.busy = false;
      this.set({ running: false });
    }
  }
}

export const faceIndexer = new FaceIndexer();
