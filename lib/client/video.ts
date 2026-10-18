/**
 * Prépare les vidéos dans le navigateur (WebCodecs, accélération matérielle) :
 * versions 1080p / 720p / 480p au format MP4 lisible partout, image d'aperçu,
 * filigrane incrusté si demandé. Rien n'est envoyé à un service extérieur.
 */
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSink,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  canEncodeAudio,
  canEncodeVideo,
} from "mediabunny";
import { ctx2d, drawWatermark, makeCanvas, toJpeg } from "./image";

export const QUALITIES = [1080, 720, 480] as const;
/** Débit visé par qualité (bits/s) : net sur téléphone comme sur grand écran. */
const BITRATE: Record<number, number> = { 1080: 5_000_000, 720: 2_500_000, 480: 1_000_000 };

export type VideoInfo = { duration: number; width: number; height: number; qualities: number[] };

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

function openInput(file: File) {
  return new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
}

export async function analyzeVideo(file: File): Promise<VideoInfo> {
  const input = openInput(file);
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("Aucune image vidéo dans ce fichier");
    const duration = await input.computeDuration();
    const width = track.displayWidth;
    const height = track.displayHeight;
    // « 1080p » = petit côté de l'image (fonctionne aussi pour les vidéos verticales).
    const short = Math.min(width, height);
    const qualities = QUALITIES.filter((q) => q <= short);
    return { duration, width, height, qualities: qualities.length ? qualities : [480] };
  } finally {
    input.dispose();
  }
}

/** Dimensions d'une version : petit côté = qualité, sans jamais agrandir l'original. */
export function renditionSize(info: VideoInfo, quality: number) {
  const short = Math.min(info.width, info.height);
  const ratio = Math.min(1, quality / short);
  return { width: even(info.width * ratio), height: even(info.height * ratio) };
}

export async function checkBrowserSupport(info: VideoInfo) {
  const { width, height } = renditionSize(info, info.qualities[0]);
  const ok = await canEncodeVideo("avc", { width, height, bitrate: BITRATE[info.qualities[0]] });
  if (!ok) throw new Error("Ce navigateur ne sait pas préparer les vidéos. Utilisez Chrome ou Safari à jour sur ordinateur.");
}

export async function makePoster(file: File, info: VideoInfo, watermark: boolean): Promise<Blob> {
  const input = openInput(file);
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("Aucune image vidéo dans ce fichier");
    const { width, height } = renditionSize(info, 720);
    const sink = new CanvasSink(track, { width, height, fit: "fill" });
    const first = await track.getFirstTimestamp();
    const frame = (await sink.getCanvas(first + Math.min(info.duration * 0.1, 3))) ?? (await sink.getCanvas(first));
    if (!frame) throw new Error("Image d'aperçu impossible");
    const out = makeCanvas(width, height);
    const ctx = ctx2d(out);
    ctx.drawImage(frame.canvas, 0, 0, width, height);
    if (watermark) drawWatermark(ctx, width, height);
    return toJpeg(out, 0.82);
  } finally {
    input.dispose();
  }
}

export async function makeRendition(
  file: File,
  info: VideoInfo,
  quality: number,
  opts: { watermark: boolean; onProgress: (p: number) => void; signal?: AbortSignal },
): Promise<Blob> {
  const input = openInput(file);
  try {
    const { width, height } = renditionSize(info, quality);
    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });

    // Filigrane : calque préparé une seule fois, posé sur chaque image.
    let process: ((sample: import("mediabunny").VideoSample) => OffscreenCanvas | HTMLCanvasElement) | undefined;
    if (opts.watermark) {
      const overlay = makeCanvas(width, height);
      drawWatermark(ctx2d(overlay), width, height);
      const frame = makeCanvas(width, height);
      const ctx = ctx2d(frame);
      process = (sample) => {
        sample.draw(ctx, 0, 0, width, height);
        sample.close();
        ctx.drawImage(overlay, 0, 0);
        return frame;
      };
    }

    const audioCodec = (await canEncodeAudio("aac")) ? "aac" : "opus";
    const conversion = await Conversion.init({
      input,
      output,
      video: {
        codec: "avc",
        width,
        height,
        fit: "fill",
        bitrate: BITRATE[quality],
        keyFrameInterval: 2, // déplacements rapides dans la vidéo et changement de qualité fluide
        forceTranscode: true,
        ...(process ? { process, processedWidth: width, processedHeight: height } : {}),
      },
      audio: { codec: audioCodec, bitrate: 128_000 },
    });
    if (!conversion.isValid) throw new Error("Vidéo illisible par ce navigateur");
    opts.signal?.addEventListener("abort", () => void conversion.cancel(), { once: true });
    conversion.onProgress = (p) => opts.onProgress(p);
    await conversion.execute();
    if (!target.buffer) throw new Error("Conversion vide");
    return new Blob([target.buffer], { type: "video/mp4" });
  } finally {
    input.dispose();
  }
}
