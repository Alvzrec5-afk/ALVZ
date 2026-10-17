import { revalidatePath } from "next/cache";
import { apiError, requireAdminApi } from "@/lib/auth";
import { PURGE_FIELDS, purgeRows } from "@/lib/purge";

const BATCH = 150;

/**
 * Supprime une collection ou une galerie entière, par lots pour rester sous
 * la limite de durée des fonctions Netlify. Le navigateur rappelle cette route
 * tant que `done` vaut false.
 */
export async function POST(req: Request) {
  try {
    const { supabase } = await requireAdminApi();
    const { kind, id } = (await req.json()) as { kind: "gallery" | "collection"; id: string };
    if ((kind !== "gallery" && kind !== "collection") || !id) {
      return Response.json({ error: "Requête invalide" }, { status: 400 });
    }
    const column = kind === "gallery" ? "gallery_id" : "collection_id";
    const { data, error } = await supabase.from("photos").select(PURGE_FIELDS).eq(column, id).limit(BATCH);
    if (error) throw new Error(error.message);
    await purgeRows(supabase, data ?? []);
    if ((data?.length ?? 0) === BATCH) return Response.json({ done: false });

    const table = kind === "gallery" ? "galleries" : "collections";
    const { error: delError } = await supabase.from(table).delete().eq("id", id);
    if (delError) throw new Error(delError.message);
    revalidatePath("/admin");
    return Response.json({ done: true });
  } catch (e) {
    return apiError(e);
  }
}
