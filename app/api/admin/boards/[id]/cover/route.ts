import { randomBytes } from "node:crypto";
import { apiError, requireAdminApi } from "@/lib/auth";
import { MAX_BOARD_IMAGE_BYTES, isUuid } from "@/lib/boards";
import { presignPut } from "@/lib/storage";

/** Adresse d'envoi direct vers Oracle pour la couverture d'un tableau (nouveau nom à chaque fois : pas de cache). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdminApi();
    const { id } = await params;
    const { size } = (await req.json()) as { size: number };
    if (!isUuid(id) || !(size > 0) || size > MAX_BOARD_IMAGE_BYTES) return Response.json({ error: "Requête invalide" }, { status: 400 });
    const { data: board } = await supabase.from("boards").select("id").eq("id", id).maybeSingle();
    if (!board) return Response.json({ error: "Tableau introuvable" }, { status: 404 });
    const key = `boards/${id}/cover-${randomBytes(6).toString("hex")}.jpg`;
    return Response.json({ key, url: await presignPut(key, "image/jpeg") });
  } catch (e) {
    return apiError(e);
  }
}
