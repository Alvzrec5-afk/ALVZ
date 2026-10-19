import { apiError, requireAdminApi } from "@/lib/auth";
import { BOARD_AUDIO_TYPES, BOARD_VIDEO_TYPES, MAX_BOARD_FILE_BYTES, MAX_BOARD_IMAGE_BYTES, MAX_BOARD_VIDEO_BYTES, boardImageKey, isUuid } from "@/lib/boards";
import { formatBytes } from "@/lib/format";
import { presignPut } from "@/lib/storage";
import { storageUsage } from "@/lib/usage";

/** Types de documents gardés tels quels ; les autres sont rangés comme fichier quelconque (toujours téléchargés). */
const SAFE_DOCUMENT_TYPES = /^(application\/(pdf|msword|rtf|zip|x-zip-compressed|vnd\.(openxmlformats-officedocument|ms-excel|ms-powerpoint|apple)\.[\w.-]+)|text\/(plain|csv|markdown))$/;

/**
 * Adresse d'envoi direct vers Oracle pour le fichier d'une carte : image (JPEG préparé), ou pour le studio
 * petite vidéo (`type` = video/…), son (`media` = "audio") ou document (`media` = "document").
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdminApi();
    const { id } = await params;
    const { itemId, size, type, media } = (await req.json()) as { itemId: string; size: number; type?: string; media?: string };
    const video = !media && typeof type === "string" && type.startsWith("video/");
    if (video && !BOARD_VIDEO_TYPES.includes(type)) return Response.json({ error: "Format vidéo non pris en charge (MP4, MOV ou WebM)" }, { status: 400 });
    if (media === "audio" && !BOARD_AUDIO_TYPES.includes(type ?? "")) {
      return Response.json({ error: "Format audio non pris en charge (MP3, M4A, WAV, AAC, OGG ou FLAC)" }, { status: 400 });
    }
    if (media && media !== "audio" && media !== "document") return Response.json({ error: "Requête invalide" }, { status: 400 });
    const max = video ? MAX_BOARD_VIDEO_BYTES : media ? MAX_BOARD_FILE_BYTES : MAX_BOARD_IMAGE_BYTES;
    if (!isUuid(id) || !isUuid(itemId) || !(size > 0) || size > max) {
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
    const contentType =
      video || media === "audio"
        ? type!
        : media === "document"
          ? SAFE_DOCUMENT_TYPES.test(type ?? "")
            ? type!
            : "application/octet-stream"
          : "image/jpeg";
    return Response.json({ url: await presignPut(boardImageKey(id, itemId), contentType), contentType });
  } catch (e) {
    return apiError(e);
  }
}
