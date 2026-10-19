import { apiError, requireAdminApi } from "@/lib/auth";
import { BOARD_VIDEO_TYPES, MAX_BOARD_IMAGE_BYTES, MAX_BOARD_VIDEO_BYTES, boardImageKey, isUuid } from "@/lib/boards";
import { formatBytes } from "@/lib/format";
import { presignPut } from "@/lib/storage";
import { storageUsage } from "@/lib/usage";

/** Adresse d'envoi direct vers Oracle pour l'image (ou la petite vidéo, `type` = video/…) d'une carte. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdminApi();
    const { id } = await params;
    const { itemId, size, type } = (await req.json()) as { itemId: string; size: number; type?: string };
    const video = typeof type === "string" && type.startsWith("video/");
    if (video && !BOARD_VIDEO_TYPES.includes(type)) return Response.json({ error: "Format vidéo non pris en charge (MP4, MOV ou WebM)" }, { status: 400 });
    if (!isUuid(id) || !isUuid(itemId) || !(size > 0) || size > (video ? MAX_BOARD_VIDEO_BYTES : MAX_BOARD_IMAGE_BYTES)) {
      return Response.json({ error: "Requête invalide" }, { status: 400 });
    }
    const [{ data: board }, { data: item }, usage] = await Promise.all([
      supabase.from("boards").select("id").eq("id", id).maybeSingle(),
      supabase.from("board_items").select("board_id").eq("id", itemId).maybeSingle(),
      storageUsage(supabase),
    ]);
    if (!board || (item && item.board_id !== id)) return Response.json({ error: "Tableau introuvable" }, { status: 404 });
    if (usage.total + size > usage.limit) {
      return Response.json({ error: `Stockage plein (${formatBytes(usage.total)} sur ${formatBytes(usage.limit)}).` }, { status: 413 });
    }
    return Response.json({ url: await presignPut(boardImageKey(id, itemId), video ? type : "image/jpeg") });
  } catch (e) {
    return apiError(e);
  }
}
