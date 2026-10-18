/**
 * File d'envoi des vidéos, une à la fois (la préparation occupe l'ordinateur) :
 * l'original part pendant que les versions 1080p / 720p / 480p sont préparées.
 */
import { api, put, withRetry } from "./uploader";

export type VideoItem = {
  id: number;
  file: File;
  status: "queued" | "working" | "done" | "error";
  step: string;
  progress: number; // 0 → 1
  error?: string;
};

type Prepared = {
  videoId: string;
  renditions: Record<string, string>;
  poster: string;
  original:
    | { kind: "single"; url: string; contentType: string }
    | { kind: "multipart"; partSize: number; partCount: number; parts: { partNumber: number; url: string }[] };
};

export class VideoUploader {
  private items: VideoItem[] = [];
  private snapshot: VideoItem[] = [];
  private listeners = new Set<() => void>();
  private running = false;
  private nextId = 1;

  constructor(
    private galleryId: string,
    private watermark: () => boolean,
    private onDone: () => void,
  ) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snapshot;

  private emit() {
    this.snapshot = this.items.map((i) => ({ ...i }));
    this.listeners.forEach((fn) => fn());
  }
  private update(item: VideoItem, patch: Partial<VideoItem>) {
    Object.assign(item, patch);
    this.emit();
  }

  add(files: File[]) {
    for (const file of files) {
      this.items.push({ id: this.nextId++, file, status: "queued", step: "En attente", progress: 0 });
    }
    this.emit();
    void this.pump();
  }

  retryFailed() {
    for (const i of this.items) if (i.status === "error") Object.assign(i, { status: "queued", step: "En attente", progress: 0, error: undefined });
    this.emit();
    void this.pump();
  }

  clearFinished() {
    this.items = this.items.filter((i) => i.status !== "done");
    this.emit();
  }

  private async pump() {
    if (this.running) return;
    this.running = true;
    for (let next = this.items.find((i) => i.status === "queued"); next; next = this.items.find((i) => i.status === "queued")) {
      const item = next;
      this.update(item, { status: "working" });
      try {
        await this.process(item);
        this.update(item, { status: "done", step: "Prête", progress: 1 });
        this.onDone();
      } catch (e) {
        this.update(item, { status: "error", step: "Échec", error: e instanceof Error ? e.message : String(e) });
      }
    }
    this.running = false;
  }

  private async process(item: VideoItem) {
    const { file } = item;
    const watermark = this.watermark();
    // Bibliothèque de conversion chargée seulement au premier envoi (page du studio plus légère).
    const { analyzeVideo, checkBrowserSupport, makePoster, makeRendition, renditionSize } = await import("./video");
    this.update(item, { step: "Analyse" });
    const info = await analyzeVideo(file);
    await checkBrowserSupport(info);

    const prepared = await withRetry(() =>
      api<Prepared>("/api/admin/videos/prepare", {
        galleryId: this.galleryId,
        filename: file.name,
        size: file.size,
        type: file.type || "video/mp4",
        duration: info.duration,
        width: info.width,
        height: info.height,
        heights: info.qualities,
        watermark,
      }),
    );

    // Progression : 60 % pour la préparation des versions, 40 % pour l'envoi de l'original.
    let encode = 0;
    let uploaded = 0;
    const report = (step?: string) =>
      this.update(item, { progress: Math.min(0.99, encode * 0.6 + (uploaded / file.size) * 0.4), ...(step ? { step } : {}) });

    const original = this.sendOriginal(prepared, file, (n) => {
      uploaded = n;
      report();
    });
    original.catch(() => undefined); // l'erreur éventuelle est relevée plus bas

    const poster = await makePoster(file, info, watermark);
    await withRetry(() => put(prepared.poster, poster, "image/jpeg", () => undefined));

    const renditions: { h: number; w: number; bytes: number }[] = [];
    const weights = info.qualities.map((q) => q * q);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let doneWeight = 0;
    for (const [i, q] of info.qualities.entries()) {
      report(`Préparation ${q}p`);
      const blob = await makeRendition(file, info, q, {
        watermark,
        onProgress: (p) => {
          encode = (doneWeight + weights[i] * p) / totalWeight;
          report();
        },
      });
      doneWeight += weights[i];
      report(`Envoi ${q}p`);
      await withRetry(() => put(prepared.renditions[q], blob, "video/mp4", () => undefined));
      renditions.push({ h: q, w: renditionSize(info, q).width, bytes: blob.size });
    }

    report("Envoi de l'original");
    await original;
    this.update(item, { step: "Finalisation" });
    await withRetry(() => api("/api/admin/videos/complete", { videoId: prepared.videoId, renditions, posterBytes: poster.size }));
  }

  private async sendOriginal(prepared: Prepared, file: File, onProgress: (n: number) => void) {
    if (prepared.original.kind === "single") {
      const { url, contentType } = prepared.original;
      await withRetry(() => put(url, file, contentType, onProgress));
      return;
    }
    const { partSize, parts } = prepared.original;
    const inFlight = new Map<number, number>();
    let confirmed = 0;
    const tell = () => onProgress(confirmed + [...inFlight.values()].reduce((a, b) => a + b, 0));
    const queue = [...parts];
    const worker = async () => {
      for (let p = queue.shift(); p; p = queue.shift()) {
        const part = p;
        const start = (part.partNumber - 1) * partSize;
        const blob = file.slice(start, Math.min(start + partSize, file.size));
        await withRetry(async () => {
          inFlight.set(part.partNumber, 0);
          try {
            await put(part.url, blob, null, (n) => {
              inFlight.set(part.partNumber, n);
              tell();
            });
          } finally {
            inFlight.delete(part.partNumber);
          }
        });
        confirmed += blob.size;
        tell();
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  }
}
