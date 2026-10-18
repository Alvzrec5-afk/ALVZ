import { apiError, requireAdminApi } from "@/lib/auth";
import { PART_SIZE, RENDITION_HEIGHTS, completeMultipart, videoKey } from "@/lib/storage";

export async function POST(req: Request) {
  try {
    const { supabase } = await requireAdminApi();
    const { videoId, renditions, posterBytes } = (await req.json()) as {
      videoId: string;
      renditions: { h: number; w: number; bytes: number }[];
      posterBytes: number;
    };
    const clean = (renditions ?? [])
      .filter((r) => (RENDITION_HEIGHTS as readonly number[]).includes(r.h) && r.bytes > 0)
      .map((r) => ({ h: r.h, w: Math.round(r.w) || 0, bytes: Math.round(r.bytes) }));
    if (clean.length === 0) return Response.json({ error: "Aucune version reçue" }, { status: 400 });

    const { data: video } = await supabase
      .from("videos")
      .select("id, gallery_id, original_ext, multipart_upload_id, size_bytes")
      .eq("id", videoId)
      .maybeSingle();
    if (!video) return Response.json({ error: "Vidéo introuvable" }, { status: 404 });

    if (video.multipart_upload_id) {
      await completeMultipart(
        videoKey(video.gallery_id, video.id, `original.${video.original_ext}`),
        video.multipart_upload_id,
        Math.ceil(Number(video.size_bytes) / PART_SIZE),
      );
    }
    const { error } = await supabase
      .from("videos")
      .update({
        status: "ready",
        multipart_upload_id: null,
        renditions: clean,
        extra_bytes: clean.reduce((s, r) => s + r.bytes, 0) + Math.max(0, Math.round(Number(posterBytes) || 0)),
      })
      .eq("id", video.id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
