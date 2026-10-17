import { apiError, requireAdminApi } from "@/lib/auth";

/** Réorganisation manuelle : une seule photo change de position (milieu entre ses voisines). */
export async function POST(req: Request) {
  try {
    const { supabase } = await requireAdminApi();
    const { photoId, position } = (await req.json()) as { photoId: string; position: number };
    if (!photoId || typeof position !== "number" || !Number.isFinite(position)) {
      return Response.json({ error: "Requête invalide" }, { status: 400 });
    }
    const { error } = await supabase.from("photos").update({ position }).eq("id", photoId);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
