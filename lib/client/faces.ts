/**
 * Reconnaissance des visages, entièrement dans le navigateur (face-api / TensorFlow.js).
 * - Studio : chaque photo est analysée en pleine définition, découpée en morceaux qui se chevauchent,
 *   pour trouver aussi les petites têtes d'une photo de groupe. Seules les « empreintes » (128 nombres)
 *   partent au serveur.
 * - Client : le selfie reste sur le téléphone ; seule son empreinte sert à la recherche.
 */
import type * as FaceApi from "@vladmandic/face-api";

/** Modèles servis gratuitement par jsDelivr (≈ 12 Mo, mis en cache par le navigateur). */
export const FACE_MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

export type FoundFace = { box: { x: number; y: number; w: number; h: number }; descriptor: number[] };

let loading: Promise<typeof FaceApi> | null = null;

/** Charge la bibliothèque et les trois modèles (une seule fois par page). */
export function loadFaceApi(): Promise<typeof FaceApi> {
  loading ??= (async () => {
    const faceapi = await import("@vladmandic/face-api");
    // WebGL (carte graphique) si possible, sinon le processeur (plus lent mais partout).
    const tf = faceapi.tf as unknown as { setBackend(name: string): Promise<boolean>; ready(): Promise<void> };
    const gpu = await tf.setBackend("webgl").catch(() => false);
    if (!gpu) await tf.setBackend("cpu");
    await tf.ready();
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(FACE_MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL),
    ]);
    return faceapi;
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

type Rect = { x: number; y: number; w: number; h: number; score: number };

const BASE_EDGE = 4000; // l'original est ramené à 4000 px au plus (au-delà, rien de plus à gagner)
const TILE = 900; // morceaux analysés un par un : un petit visage y reste assez grand pour être vu
const MIN_FACE = 28; // en dessous (en px sur l'image de base), le visage est trop petit pour être reconnu

function canvasOf(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function iou(a: Rect, b: Rect) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = x * y;
  return inter / (a.w * a.h + b.w * b.h - inter || 1);
}

/** Un visage trouvé dans deux morceaux voisins ne compte qu'une fois (on garde le plus sûr). */
function dedupe(rects: Rect[]) {
  const kept: Rect[] = [];
  for (const r of [...rects].sort((a, b) => b.score - a.score)) {
    // Même visage : forte superposition, ou l'un contient presque entièrement l'autre (visage coupé au bord d'un morceau).
    const same = (k: Rect) => {
      const inter = iou(r, k);
      const overlap = Math.max(0, Math.min(r.x + r.w, k.x + k.w) - Math.max(r.x, k.x)) * Math.max(0, Math.min(r.y + r.h, k.y + k.h) - Math.max(r.y, k.y));
      return inter > 0.3 || overlap > 0.6 * Math.min(r.w * r.h, k.w * k.h);
    };
    if (!kept.some(same)) kept.push(r);
  }
  return kept;
}

const pause = () => new Promise((r) => setTimeout(r, 0)); // laisse respirer l'interface entre deux calculs

/**
 * Tous les visages d'une photo, avec leur empreinte.
 * `source` : l'image d'origine (ImageBitmap ou <img>), `width` × `height` sa taille réelle.
 */
export async function facesInImage(source: CanvasImageSource, width: number, height: number): Promise<FoundFace[]> {
  const faceapi = await loadFaceApi();
  const scale = Math.min(1, BASE_EDGE / Math.max(width, height));
  const W = Math.round(width * scale);
  const H = Math.round(height * scale);
  const base = canvasOf(W, H);
  base.getContext("2d")!.drawImage(source, 0, 0, W, H);

  const detector = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45, maxResults: 200 });
  const rects: Rect[] = [];
  const collect = async (input: HTMLCanvasElement, ox: number, oy: number, k: number) => {
    const found = await faceapi.detectAllFaces(input, detector);
    for (const d of found) rects.push({ x: ox + d.box.x / k, y: oy + d.box.y / k, w: d.box.width / k, h: d.box.height / k, score: d.score });
    await pause();
  };

  // 1. Vue d'ensemble (gros plans, visages qui dépasseraient d'un morceau).
  const k0 = Math.min(1, 1200 / Math.max(W, H));
  const overview = canvasOf(W * k0, H * k0);
  overview.getContext("2d")!.drawImage(base, 0, 0, overview.width, overview.height);
  await collect(overview, 0, 0, k0);

  // 2. Morceaux de 900 px qui se chevauchent d'un quart : les petites têtes des photos de groupe.
  if (Math.max(W, H) > TILE * 1.2) {
    const step = Math.round(TILE * 0.75);
    const tile = canvasOf(TILE, TILE);
    const tctx = tile.getContext("2d")!;
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const tx = Math.min(x, Math.max(0, W - TILE));
        const ty = Math.min(y, Math.max(0, H - TILE));
        tctx.clearRect(0, 0, TILE, TILE);
        tctx.drawImage(base, tx, ty, TILE, TILE, 0, 0, TILE, TILE);
        await collect(tile, tx, ty, 1);
        if (x + TILE >= W) break;
      }
      if (y + TILE >= H) break;
    }
  }

  // 3. Chaque visage est recadré (avec de la marge), mis à une bonne taille, puis son empreinte est calculée.
  const faces: FoundFace[] = [];
  for (const r of dedupe(rects)) {
    if (Math.min(r.w, r.h) < MIN_FACE) continue;
    const m = Math.max(r.w, r.h) * 0.6;
    const cx = Math.max(0, r.x - m);
    const cy = Math.max(0, r.y - m);
    const cw = Math.min(W, r.x + r.w + m) - cx;
    const ch = Math.min(H, r.y + r.h + m) - cy;
    const k = 220 / Math.max(r.w, r.h); // visage ≈ 220 px dans le recadrage
    const crop = canvasOf(cw * k, ch * k);
    crop.getContext("2d")!.drawImage(base, cx, cy, cw, ch, 0, 0, crop.width, crop.height);
    const one = await faceapi.detectSingleFace(crop, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })).withFaceLandmarks().withFaceDescriptor();
    await pause();
    if (!one) continue;
    faces.push({
      box: { x: r.x / W, y: r.y / H, w: r.w / W, h: r.h / H },
      descriptor: Array.from(one.descriptor, (n) => Math.round(n * 1e5) / 1e5),
    });
  }
  return faces;
}

/** Empreinte du visage principal d'un selfie (le plus grand visage), ou null si aucun visage n'est vu. */
export async function selfieDescriptor(file: File): Promise<number[] | null> {
  const faceapi = await loadFaceApi();
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  // Taille utile (ni trop petite ni trop grande) + une marge autour : un selfie recadré au ras du visage
  // est mieux détecté s'il ne touche pas les bords.
  const k = Math.min(1280, Math.max(640, Math.max(bitmap.width, bitmap.height))) / Math.max(bitmap.width, bitmap.height);
  const w = bitmap.width * k;
  const h = bitmap.height * k;
  const pad = Math.round(Math.max(w, h) * 0.25);
  const c = canvasOf(w + 2 * pad, h + 2 * pad);
  const g = c.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bitmap, pad, pad, w, h);
  bitmap.close();
  const all = await faceapi.detectAllFaces(c, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 })).withFaceLandmarks().withFaceDescriptors();
  if (!all.length) return null;
  const main = all.reduce((a, b) => (b.detection.box.area > a.detection.box.area ? b : a));
  return Array.from(main.descriptor, (n) => Math.round(n * 1e5) / 1e5);
}
