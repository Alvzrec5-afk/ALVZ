import { apiError, requireAdminApi } from "@/lib/auth";
import { fillSlotFrom, isUuid, projectImages } from "@/lib/boards";

/** Photos déjà présentes dans le projet (tableau principal et toutes ses planches). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdminApi();
    const { id } = await params;
    if (!isUuid(id)) return Response.json({ error: "Requête invalide" }, { status: 400 });
    return Response.json({ images: await projectImages(supabase, id) });
  } catch (e) {
    return apiError(e);
  }
}

/** Remplit la case photo `itemId` avec une copie de la photo `fromId`. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdminApi();
    const { id } = await params;
    const { itemId, fromId } = (await req.json()) as { itemId: string; fromId: string };
    if (!isUuid(id)) return Response.json({ error: "Requête invalide" }, { status: 400 });
    return Response.json(await fillSlotFrom(supabase, id, itemId, fromId));
  } catch (e) {
    return apiError(e);
  }
}
