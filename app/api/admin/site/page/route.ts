import { apiError, requireAdminApi } from "@/lib/auth";
import { siteFileForOldAccount } from "@/lib/site";

/** Fichier index.html du site, à glisser sur l'ancien compte Netlify (il lit son contenu dans le studio). */
export async function GET() {
  try {
    await requireAdminApi();
    return new Response(siteFileForOldAccount(), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": 'attachment; filename="index.html"', "Cache-Control": "no-store" },
    });
  } catch (e) {
    return apiError(e);
  }
}
