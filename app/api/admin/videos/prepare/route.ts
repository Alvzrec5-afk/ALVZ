import { apiError, requireAdminApi } from "@/lib/auth";
import { formatBytes } from "@/lib/format";
import { storageUsage } from "@/lib/usage";
import { MULTIPART_THRESHOLD, PART_SIZE, RENDITION_HEIGHTS, createMultipart, presignPart, presignPut, videoKey } from "@/lib/storage";

type Body = {
  galleryId: string;
  filename: string;
  size: number;
  type: string;
  duration: number;
  width: number;
  height: number;
  heights: number[];
  watermark: boolean;
};

/** Débit moyen visé par qualité (octets par seconde), pour estimer la place nécessaire. */
const RATE: Record<number, number> = { 2160: 14e6 / 8, 1080: 5e6 / 8, 720: 2.5e6 / 8, 480: 1e6 / 8 };

function extensionOf(filename: string) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(filename);
  return m ? m[1].toLowerCase() : "mp4";
}

/** Crée la vidéo et renvoie les adresses d'envoi : original, versions et image d'aperçu. */
export async function POST(req: Request) {
  try {
    const { supabase } = await requireAdminApi();
    const body = (await req.json()) as Body;
    const heights = RENDITION_HEIGHTS.filter((h) => body.heights?.includes(h));
    if (!body.galleryId || !body.filename || !(body.size > 0) || heights.length === 0) {
      return Response.json({ error: "Requête invalide" }, { status: 400 });
    }
    const { data: gallery } = await supabase.from("galleries").select("id").eq("id", body.galleryId).maybeSingle();
    if (!gallery) return Response.json({ error: "Galerie introuvable" }, { status: 404 });

    const duration = Math.max(0, Number(body.duration) || 0);
    const usage = await storageUsage(supabase);
    const estimate = body.size + heights.reduce((s, h) => s + RATE[h] * duration, 0);
    if (usage.total + estimate > usage.limit) {
      return Response.json(
        { error: `Stockage insuffisant (${formatBytes(usage.total)} sur ${formatBytes(usage.limit)}, cette vidéo demande environ ${formatBytes(estimate)}).` },
        { status: 413 },
      );
    }

    const ext = extensionOf(body.filename);
    const contentType = body.type || "video/mp4";
    const { data: last } = await supabase
      .from("videos")
      .select("position")
      .eq("gallery_id", body.galleryId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: video, error } = await supabase
      .from("videos")
      .insert({
        gallery_id: body.galleryId,
        title: body.filename.replace(/\.[^.]+$/, "").slice(0, 200) || "Vidéo",
        filename: body.filename.slice(0, 255),
        original_ext: ext,
        original_type: contentType,
        size_bytes: body.size,
        duration,
        width: Math.round(Number(body.width) || 0),
        height: Math.round(Number(body.height) || 0),
        watermarked: Boolean(body.watermark),
        position: (last?.position ?? 0) + 1000,
      })
      .select("id")
      .single();
    if (error || !video) throw new Error(error?.message ?? "Création impossible");

    const key = (name: string) => videoKey(body.galleryId, video.id, name);
    const renditions = Object.fromEntries(
      await Promise.all(heights.map(async (h) => [h, await presignPut(key(`${h}.mp4`), "video/mp4")] as const)),
    );
    const poster = await presignPut(key("poster.jpg"), "image/jpeg");

    const originalKey = key(`original.${ext}`);
    if (body.size <= MULTIPART_THRESHOLD) {
      return Response.json({ videoId: video.id, renditions, poster, original: { kind: "single", url: await presignPut(originalKey, contentType), contentType } });
    }
    const uploadId = await createMultipart(originalKey, contentType);
    await supabase.from("videos").update({ multipart_upload_id: uploadId }).eq("id", video.id);
    const partCount = Math.ceil(body.size / PART_SIZE);
    const parts = await Promise.all(
      Array.from({ length: partCount }, (_, i) => i + 1).map(async (n) => ({ partNumber: n, url: await presignPart(originalKey, uploadId, n) })),
    );
    return Response.json({ videoId: video.id, renditions, poster, original: { kind: "multipart", partSize: PART_SIZE, partCount, parts } });
  } catch (e) {
    return apiError(e);
  }
}
