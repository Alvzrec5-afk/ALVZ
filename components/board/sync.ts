/**
 * Enregistrement automatique d'un tableau : les modifications sont regroupées (une par carte,
 * la dernière l'emporte), envoyées toutes les ~0,7 s, et renvoyées après une coupure réseau.
 */
import type { BoardOp } from "@/lib/board-types";

export type SyncStatus = { state: "saved" | "saving" | "error"; message?: string };

const opId = (op: BoardOp) => (op.op === "put" ? op.item.id : op.id);

export class BoardSync {
  private queue = new Map<string, BoardOp>();
  private inflight = new Map<string, BoardOp>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retries = 0;

  constructor(
    private endpoint: string,
    private onStatus: (s: SyncStatus) => void,
  ) {}

  push(op: BoardOp) {
    this.queue.set(opId(op), op);
    this.onStatus({ state: "saving" });
    this.schedule(700);
  }

  /** Carte modifiée localement mais pas encore confirmée par le serveur. */
  isPending(id: string) {
    return this.queue.has(id) || this.inflight.has(id);
  }

  get busy() {
    return this.queue.size + this.inflight.size > 0;
  }

  private schedule(ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), ms);
  }

  async flush(keepalive = false) {
    if (this.inflight.size || !this.queue.size) return;
    for (const [id, op] of this.queue) this.inflight.set(id, op);
    this.queue.clear();
    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops: [...this.inflight.values()] }),
        keepalive,
      });
      if (res.status >= 400 && res.status < 500) {
        // Refus définitif (droits, données invalides) : inutile de réessayer.
        const json = await res.json().catch(() => ({}));
        this.inflight.clear();
        this.onStatus({ state: "error", message: json.error || `Erreur ${res.status}` });
        return;
      }
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      this.inflight.clear();
      this.retries = 0;
      if (this.queue.size) this.schedule(150);
      else this.onStatus({ state: "saved" });
    } catch {
      for (const [id, op] of this.inflight) if (!this.queue.has(id)) this.queue.set(id, op);
      this.inflight.clear();
      this.retries++;
      this.onStatus({ state: "error", message: "Connexion perdue — nouvel essai…" });
      this.schedule(Math.min(30_000, 1000 * 2 ** this.retries));
    }
  }
}
