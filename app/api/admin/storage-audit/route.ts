import { apiError, requireAdminApi } from "@/lib/auth";
import { auditStorage, cleanStorage } from "@/lib/storage-audit";
import { refreshOracleTotal } from "@/lib/usage";

export const maxDuration = 26;

/** Espace réel chez Oracle (fichiers suivis, orphelins, envois interrompus). */
export async function GET() {
  try {
    const { supabase } = await requireAdminApi();
    return Response.json(await auditStorage(supabase));
  } catch (e) {
    return apiError(e);
  }
}

/** Libère l'espace : fichiers orphelins et envois interrompus de plus de 24 h. */
export async function POST() {
  try {
    const { supabase } = await requireAdminApi();
    const result = await cleanStorage(supabase);
    refreshOracleTotal();
    return Response.json(result);
  } catch (e) {
    return apiError(e);
  }
}
