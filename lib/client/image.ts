/**
 * Génère dans le navigateur les déclinaisons d'une photo :
 * miniature (~640 px), version web (2000 px, ~400 Ko) et leurs variantes filigranées.
 */

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export const WEB_SIZE = 2000;
export const THUMB_SIZE = 640;
const WEB_TARGET_BYTES = 420_000;

export function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: AnyCanvas): Ctx {
  const ctx = c.getContext("2d") as Ctx | null;
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

export function toJpeg(c: AnyCanvas, quality: number): Promise<Blob> {
  if ("convertToBlob" in c) return c.convertToBlob({ type: "image/jpeg", quality });
  return new Promise((resolve, reject) =>
    (c as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error("Encodage impossible"))), "image/jpeg", quality),
  );
}

/** Réduction par paliers (÷2) pour un rendu net, sans crénelage. */
function scaleDown(source: CanvasImageSource, sw: number, sh: number, maxEdge: number): AnyCanvas {
  const ratio = Math.min(1, maxEdge / Math.max(sw, sh));
  const tw = Math.max(1, Math.round(sw * ratio));
  const th = Math.max(1, Math.round(sh * ratio));
  let src: CanvasImageSource = source;
  let w = sw;
  let h = sh;
  while (w / 2 >= tw && h / 2 >= th) {
    const step = makeCanvas(Math.round(w / 2), Math.round(h / 2));
    ctx2d(step).drawImage(src, 0, 0, step.width, step.height);
    src = step;
    w = step.width;
    h = step.height;
  }
  const out = makeCanvas(tw, th);
  ctx2d(out).drawImage(src, 0, 0, tw, th);
  return out;
}

/** Motif de filigrane en diagonale (texte répété), dessiné par-dessus ce qui est déjà sur le canvas. */
export function drawWatermark(ctx: Ctx, width: number, height: number, text = "ALVZ.REC") {
  const size = Math.max(14, Math.round(Math.max(width, height) / 26));
  ctx.font = `300 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const spaced = text.split("").join(String.fromCharCode(8202)); // espacement fin entre les lettres
  const stepX = size * 9;
  const stepY = size * 5;
  const diag = Math.hypot(width, height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 7);
  for (let y = -diag / 2, row = 0; y < diag / 2; y += stepY, row++) {
    for (let x = -diag / 2 + (row % 2) * (stepX / 2); x < diag / 2; x += stepX) {
      ctx.fillStyle = "rgba(0,0,0,0.10)";
      ctx.fillText(spaced, x + 1, y + 1);
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.fillText(spaced, x, y);
    }
  }
  ctx.restore();
}

function withWatermark(source: AnyCanvas, text: string): AnyCanvas {
  const c = makeCanvas(source.width, source.height);
  const ctx = ctx2d(c);
  ctx.drawImage(source, 0, 0);
  drawWatermark(ctx, c.width, c.height, text);
  return c;
}

async function encodeUnder(c: AnyCanvas, maxBytes: number) {
  let blob = await toJpeg(c, 0.84);
  for (const q of [0.76, 0.68, 0.6]) {
    if (blob.size <= maxBytes) break;
    blob = await toJpeg(c, q);
  }
  return blob;
}

export type Variants = {
  width: number;
  height: number;
  thumb: Blob;
  thumb_wm: Blob;
  web: Blob;
  web_wm: Blob;
};

export async function makeVariants(file: File, watermarkText = "ALVZ.REC"): Promise<Variants> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Format d'image non lisible par ce navigateur");
  }
  try {
    const web = scaleDown(bitmap, bitmap.width, bitmap.height, WEB_SIZE);
    const thumb = scaleDown(web, web.width, web.height, THUMB_SIZE);
    const [webBlob, webWm, thumbBlob, thumbWm] = await Promise.all([
      encodeUnder(web, WEB_TARGET_BYTES),
      encodeUnder(withWatermark(web, watermarkText), WEB_TARGET_BYTES),
      toJpeg(thumb, 0.8),
      toJpeg(withWatermark(thumb, watermarkText), 0.8),
    ]);
    return { width: bitmap.width, height: bitmap.height, web: webBlob, web_wm: webWm, thumb: thumbBlob, thumb_wm: thumbWm };
  } finally {
    bitmap.close();
  }
}
