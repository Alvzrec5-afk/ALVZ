import { apiError, requireAdminApi } from "@/lib/auth";
import { PURGE_FIELDS, purgeRows } from "@/lib/purge";

export async function POST(req: Request) {
  try {
    const { supabase } = await requireAdminApi();
    const { photoIds } = (await req.json()) as { photoIds: string[] };
    if (!Array.isArray(photoIds) || photoIds.length === 0 || photoIds.length > 200) {
      return Response.json({ error: "Liste de photos invalide" }, { status: 400 });
    }
    const { data, error } = await supabase.from("photos").select(PURGE_FIELDS).in("id", photoIds);
    if (error) throw new Error(error.message);
    await purgeRows(supabase, data ?? []);
    return Response.json({ deleted: data?.length ?? 0 });
  } catch (e) {
    return apiError(e);
  }
}
