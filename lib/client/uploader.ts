/**
 * File d'envoi : plusieurs photos en parallèle, reprise automatique en cas de coupure
 * réseau, détection des doublons, progression en octets.
 */
import exifr from "exifr";
import { makeVariants } from "./image";
import { sha256, type PickedFile } from "./files";

export type ItemStatus = "queued" | "working" | "done" | "duplicate" | "error";

export type UploadItem = {
  id: number;
  file: File;
  collection: string;
  status: ItemStatus;
  step: string;
  loaded: number;
  total: number;
  error?: string;
};

type Prepared =
  | { duplicate: true }
  | {
      photoId: string;
      variants: Record<"thumb" | "thumb_wm" | "web" | "web_wm", string>;
      original:
        | { kind: "single"; url: string; contentType: string }
        | { kind: "multipart"; partSize: number; partCount: number; parts: { partNumber: number; url: string }[] };
    };

const CONCURRENCY = 4;

class PermanentError extends Error {}

function waitOnline() {
  if (typeof navigator === "undefined" || navigator.onLine) return Promise.resolve();
  return new Promise<void>((resolve) => window.addEventListener("online", () => resolve(), { once: true }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Réessaie avec un délai croissant ; attend le retour du réseau si la connexion est coupée. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 7): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await waitOnline();
      return await fn();
    } catch (e) {
      if (e instanceof PermanentError) throw e;
      lastError = e;
      await sleep(Math.min(30_000, 1000 * 2 ** i));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Échec de l'envoi");
}

async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json.error || `Erreur ${res.status}`;
    // Erreurs définitives (requête refusée, session expirée) : inutile de réessayer.
    if ([400, 401, 403, 413, 422].includes(res.status)) throw new PermanentError(message);
    throw new Error(message);
  }
  return json as T;
}

function put(url: string, body: Blob, contentType: string | null, onProgress: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (contentType) xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Stockage : erreur ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Connexion interrompue"));
    xhr.ontimeout = () => reject(new Error("Délai dépassé"));
    xhr.send(body);
  });
}

async function readTakenAt(file: File): Promise<string | null> {
  try {
    const exif = await exifr.parse(file, ["DateTimeOriginal", "CreateDate"]);
    const date: unknown = exif?.DateTimeOriginal ?? exif?.CreateDate;
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  } catch {
    return null;
  }
}

export class Uploader {
  items: UploadItem[] = [];
  private listeners = new Set<() => void>();
  private running = 0;
  private nextId = 1;
  private snapshot: UploadItem[] = [];

  constructor(
    private galleryId: string,
    private onBatchDone: () => void,
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

  private update(item: UploadItem, patch: Partial<UploadItem>) {
    Object.assign(item, patch);
    this.emit();
  }

  get busy() {
    return this.items.some((i) => i.status === "queued" || i.status === "working");
  }

  add(files: PickedFile[], defaultCollection: string) {
    const sorted = [...files].sort(
      (a, b) =>
        (a.collection ?? "").localeCompare(b.collection ?? "", "fr") ||
        a.file.name.localeCompare(b.file.name, "fr", { numeric: true }),
    );
    for (const f of sorted) {
      this.items.push({
        id: this.nextId++,
        file: f.file,
        collection: f.collection || defaultCollection,
        status: "queued",
        step: "En attente",
        loaded: 0,
        total: f.file.size,
      });
    }
    this.emit();
    this.pump();
  }

  retryFailed() {
    for (const i of this.items) if (i.status === "error") this.update(i, { status: "queued", step: "En attente", error: undefined, loaded: 0 });
    this.pump();
  }

  clearFinished() {
    this.items = this.items.filter((i) => i.status === "queued" || i.status === "working" || i.status === "error");
    this.emit();
  }

  private pump() {
    while (this.running < CONCURRENCY) {
      const next = this.items.find((i) => i.status === "queued");
      if (!next) break;
      this.running++;
      this.update(next, { status: "working" });
      this.process(next)
        .then(
          (duplicate) => this.update(next, { status: duplicate ? "duplicate" : "done", step: duplicate ? "Déjà présente" : "Envoyée", loaded: next.total }),
          (e: unknown) => this.update(next, { status: "error", step: "Échec", error: e instanceof Error ? e.message : String(e) }),
        )
        .finally(() => {
          this.running--;
          if (!this.busy) this.onBatchDone();
          this.pump();
        });
    }
  }

  /** Renvoie true si la photo était déjà dans la galerie. */
  private async process(item: UploadItem): Promise<boolean> {
    const { file } = item;
    this.update(item, { step: "Analyse" });
    const [hash, takenAt] = await Promise.all([sha256(file), readTakenAt(file)]);

    const prepared = await withRetry(() =>
      api<Prepared>("/api/admin/upload/prepare", {
        galleryId: this.galleryId,
        collectionName: item.collection,
        filename: file.name,
        hash,
        size: file.size,
        type: file.type,
        takenAt,
      }),
    );
    if ("duplicate" in prepared) return true;

    this.update(item, { step: "Préparation" });
    const variants = await makeVariants(file);
    const smallBlobs = (["thumb", "thumb_wm", "web", "web_wm"] as const).map((k) => ({ url: prepared.variants[k], blob: variants[k] }));
    const smallTotal = smallBlobs.reduce((s, b) => s + b.blob.size, 0);

    // Progression : octets confirmés + octets en cours pour chaque transfert actif.
    const inFlight = new Map<string, number>();
    let confirmed = 0;
    const total = smallTotal + file.size;
    const report = () => this.update(item, { loaded: confirmed + [...inFlight.values()].reduce((a, b) => a + b, 0), total });

    const send = async (id: string, url: string, blob: Blob, contentType: string | null) => {
      await withRetry(async () => {
        inFlight.set(id, 0);
        try {
          await put(url, blob, contentType, (n) => {
            inFlight.set(id, n);
            report();
          });
        } finally {
          inFlight.delete(id);
        }
      });
      confirmed += blob.size;
      report();
    };

    this.update(item, { step: "Envoi" });
    await Promise.all(smallBlobs.map((b, i) => send(`v${i}`, b.url, b.blob, "image/jpeg")));

    if (prepared.original.kind === "single") {
      await send("orig", prepared.original.url, file, prepared.original.contentType);
    } else {
      const { partSize, partCount, parts } = prepared.original;
      // Les morceaux déjà reçus lors d'une tentative précédente comptent comme envoyés.
      const pending = new Set(parts.map((p) => p.partNumber));
      for (let n = 1; n <= partCount; n++) {
        if (!pending.has(n)) confirmed += Math.min(partSize, file.size - (n - 1) * partSize);
      }
      report();
      const queue = [...parts];
      const worker = async () => {
        for (let p = queue.shift(); p; p = queue.shift()) {
          const start = (p.partNumber - 1) * partSize;
          await send(`p${p.partNumber}`, p.url, file.slice(start, Math.min(start + partSize, file.size)), null);
        }
      };
      await Promise.all([worker(), worker()]);
    }

    this.update(item, { step: "Finalisation" });
    await withRetry(() =>
      api("/api/admin/upload/complete", {
        photoId: prepared.photoId,
        width: variants.width,
        height: variants.height,
        variantsBytes: smallTotal,
      }),
    );
    return false;
  }
}
