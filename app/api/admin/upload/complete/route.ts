import { apiError, requireAdminApi } from "@/lib/auth";
import { PART_SIZE, completeMultipart, originalKey } from "@/lib/storage";

export async function POST(req: Request) {
  try {
    const { supabase } = await requireAdminApi();
    const { photoId, width, height, variantsBytes } = (await req.json()) as {
      photoId: string;
      width: number;
      height: number;
      variantsBytes?: number;
    };
    const { data: photo } = await supabase
      .from("photos")
      .select("id, gallery_id, original_ext, multipart_upload_id, size_bytes")
      .eq("id", photoId)
      .maybeSingle();
    if (!photo) return Response.json({ error: "Photo introuvable" }, { status: 404 });

    if (photo.multipart_upload_id) {
      await completeMultipart(
        originalKey(photo.gallery_id, photo.id, photo.original_ext),
        photo.multipart_upload_id,
        Math.ceil(Number(photo.size_bytes) / PART_SIZE),
      );
    }
    const { error } = await supabase
      .from("photos")
      .update({
        status: "ready",
        multipart_upload_id: null,
        width: Math.max(1, Math.round(width) || 1),
        height: Math.max(1, Math.round(height) || 1),
        variants_bytes: Math.max(0, Math.round(Number(variantsBytes) || 0)),
      })
      .eq("id", photo.id);
    if (error) throw new Error(error.message);

    // Première photo envoyée = couverture par défaut.
    await supabase
      .from("galleries")
      .update({ cover_photo_id: photo.id })
      .eq("id", photo.gallery_id)
      .is("cover_photo_id", null);

    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
