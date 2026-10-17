import { apiError, requireAdminApi } from "@/lib/auth";

/** Remet une collection dans l'ordre de prise de vue (EXIF), puis par nom de fichier. */
export async function POST(req: Request) {
  try {
    const { supabase } = await requireAdminApi();
    const { collectionId } = (await req.json()) as { collectionId: string };
    const { data, error } = await supabase
      .from("photos")
      .select("id, taken_at, filename, created_at")
      .eq("collection_id", collectionId);
    if (error) throw new Error(error.message);
    const sorted = (data ?? []).sort((a, b) => {
      const ta = new Date(a.taken_at ?? a.created_at).getTime();
      const tb = new Date(b.taken_at ?? b.created_at).getTime();
      return ta - tb || a.filename.localeCompare(b.filename, "fr", { numeric: true });
    });
    // La position suit l'heure de prise de vue (en ms) : les photos ajoutées plus tard
    // s'intercalent naturellement au bon endroit.
    let previous = -Infinity;
    const positions = sorted.map((p) => {
      previous = Math.max(new Date(p.taken_at ?? p.created_at).getTime(), previous + 1);
      return { id: p.id, position: previous };
    });
    for (let i = 0; i < positions.length; i += 50) {
      await Promise.all(
        positions.slice(i, i + 50).map((p) => supabase.from("photos").update({ position: p.position }).eq("id", p.id)),
      );
    }
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
