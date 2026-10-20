/**
 * Enregistrement automatique d'un tableau : les modifications sont regroupées (une par carte,
 * la dernière l'emporte), envoyées toutes les ~0,7 s, et renvoyées après une coupure réseau.
 *
 * Hors connexion (avion…) : la file est gardée sur l'appareil (localStorage), elle survit à la fermeture de
 * l'application et part dès que le réseau revient — même pour une planche qui n'est plus ouverte (`flushOrphans`).
 * Chaque modification emporte la version de la carte sur laquelle elle a été faite (`base`) : si quelqu'un (le client)
 * a modifié la même carte entre-temps, le serveur garde sa version et ajoute la nôtre à côté (`onConflicts`).
 */
import type { BoardItem, BoardOp } from "@/lib/board-types";

export type SyncStatus = { state: "saved" | "saving" | "error" | "offline"; message?: string };
export type SyncConflict = { id: string; copy: string | null };

const opId = (op: BoardOp) => (op.op === "put" ? op.item.id : op.id);
const KEY = "alvz-pending:";
const storeKey = (endpoint: string) => KEY + endpoint;

/** Tableaux ouverts en ce moment dans cette page : leur file est envoyée par eux-mêmes, pas par `flushOrphans`. */
const live = new Set<string>();

function readStored(endpoint: string): BoardOp[] {
  try {
    const ops = JSON.parse(localStorage.getItem(storeKey(endpoint)) ?? "[]");
    return Array.isArray(ops) ? (ops as BoardOp[]) : [];
  } catch {
    return [];
  }
}

/**
 * La taille d'une image n'est envoyée qu'une fois, juste après l'envoi du fichier : une modification
 * suivante de la même carte (déplacement, clic…) qui la remplace dans la file doit la garder.
 * La version de départ (`base`) reste celle de la première modification en attente.
 */
function merge(before: BoardOp | undefined, next: BoardOp): BoardOp {
  let out = next;
  if (before?.op === "put" && next.op === "put" && before.item.sizeBytes && !next.item.sizeBytes) {
    out = { ...next, item: { ...next.item, sizeBytes: before.item.sizeBytes } };
  }
  if (before && "base" in before) out = { ...out, base: before.base };
  return out;
}

export class BoardSync {
  private queue = new Map<string, BoardOp>();
  private inflight = new Map<string, BoardOp>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retries = 0;
  /** Version (date serveur) connue de chaque carte : celle reçue à l'ouverture, au rafraîchissement ou après notre envoi. */
  private known = new Map<string, string>();
  onConflicts: (c: SyncConflict[]) => void = () => {};

  constructor(
    private endpoint: string,
    private onStatus: (s: SyncStatus) => void,
  ) {
    // Modifications faites hors connexion lors d'une visite précédente : elles repartent (envoi lancé par `attach`).
    for (const op of readStored(endpoint)) this.queue.set(opId(op), op);
  }

  /** Tableau affiché dans la page : à appeler au montage (et la fonction rendue au démontage). */
  attach() {
    live.add(this.endpoint);
    if (this.queue.size) {
      this.onStatus({ state: navigator.onLine ? "saving" : "offline" });
      this.schedule(1200);
    }
    return () => {
      live.delete(this.endpoint);
      this.save();
    };
  }

  /** Versions des cartes reçues du serveur (ouverture du tableau, rafraîchissement). */
  learn(items: Pick<BoardItem, "id" | "updatedAt">[]) {
    // Jamais en arrière : un rafraîchissement parti avant notre dernier envoi rapporte une version plus ancienne
    // que la nôtre, qui ferait croire ensuite à une modification faite par quelqu'un d'autre.
    for (const it of items) {
      if (!it.updatedAt || this.isPending(it.id)) continue;
      const mine = this.known.get(it.id);
      if (!mine || Date.parse(it.updatedAt) > Date.parse(mine)) this.known.set(it.id, it.updatedAt);
    }
  }

  /** Modifications en attente (pour les remettre à l'écran quand la page est rouverte sans réseau). */
  pending(): BoardOp[] {
    return [...this.inflight.values(), ...this.queue.values()];
  }

  push(op: BoardOp) {
    const id = opId(op);
    const before = this.queue.get(id) ?? this.inflight.get(id);
    const base = before && "base" in before ? before.base : this.known.get(id);
    this.queue.set(id, merge(before, base ? { ...op, base } : op));
    this.save();
    this.onStatus({ state: navigator.onLine ? "saving" : "offline" });
    this.schedule(700);
  }

  /** Carte modifiée localement mais pas encore confirmée par le serveur. */
  isPending(id: string) {
    return this.queue.has(id) || this.inflight.has(id);
  }

  get busy() {
    return this.queue.size + this.inflight.size > 0;
  }

  /** Réseau revenu : on envoie tout de suite. */
  resume() {
    this.retries = 0;
    if (this.queue.size) this.schedule(100);
  }

  /** File gardée sur l'appareil (rien en attente = clé effacée). */
  private save() {
    try {
      const ops = this.pending();
      if (ops.length) localStorage.setItem(storeKey(this.endpoint), JSON.stringify(ops));
      else localStorage.removeItem(storeKey(this.endpoint));
    } catch {}
  }

  private schedule(ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), ms);
  }

  async flush(keepalive = false) {
    if (this.inflight.size || !this.queue.size) return;
    // Par paquets de 300 au plus (gros import) : le reste part juste après.
    for (const [id, op] of this.queue) {
      if (this.inflight.size >= 300) break;
      this.inflight.set(id, op);
    }
    for (const id of this.inflight.keys()) this.queue.delete(id);
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
        this.save();
        this.onStatus({ state: "error", message: json.error || `Erreur ${res.status}` });
        return;
      }
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const json = (await res.json().catch(() => ({}))) as { at?: string; conflicts?: SyncConflict[] };
      // Nos cartes sont maintenant la dernière version connue (les prochaines modifications partent de là).
      // Les modifications faites pendant l'envoi partent maintenant de notre version (sinon : faux conflit avec nous-mêmes).
      if (json.at) {
        for (const id of this.inflight.keys()) {
          this.known.set(id, json.at);
          const next = this.queue.get(id);
          if (next) this.queue.set(id, { ...next, base: json.at });
        }
      }
      this.inflight.clear();
      this.save();
      this.retries = 0;
      if (json.conflicts?.length) this.onConflicts(json.conflicts);
      if (this.queue.size) this.schedule(150);
      else this.onStatus({ state: "saved" });
    } catch {
      for (const [id, op] of this.inflight) this.queue.set(id, this.queue.has(id) ? merge(op, this.queue.get(id)!) : op);
      this.inflight.clear();
      this.save();
      this.retries++;
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      this.onStatus(offline ? { state: "offline" } : { state: "error", message: "Connexion perdue — nouvel essai…" });
      this.schedule(Math.min(30_000, 1000 * 2 ** this.retries));
    }
  }
}

/**
 * Réseau revenu (ou studio ouvert) : envoie les modifications gardées sur l'appareil pour les tableaux qui ne sont
 * pas ouverts (planches modifiées en avion puis quittées). Rend le nombre de cartes envoyées et de conflits.
 */
export async function flushOrphans(): Promise<{ sent: number; conflicts: number }> {
  let sent = 0;
  let conflicts = 0;
  let keys: string[] = [];
  try {
    keys = Object.keys(localStorage).filter((k) => k.startsWith(KEY));
  } catch {
    return { sent, conflicts };
  }
  for (const key of keys) {
    const endpoint = key.slice(KEY.length);
    if (live.has(endpoint)) continue;
    const ops = readStored(endpoint);
    if (!ops.length) {
      localStorage.removeItem(key);
      continue;
    }
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ops }) });
      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as { conflicts?: SyncConflict[] };
        conflicts += json.conflicts?.length ?? 0;
        sent += ops.length;
        localStorage.removeItem(key);
      } else if (res.status >= 400 && res.status < 500) {
        localStorage.removeItem(key); // refus définitif (tableau supprimé, droits) : inutile de garder
      }
    } catch {
      break; // toujours pas de réseau
    }
  }
  return { sent, conflicts };
}
