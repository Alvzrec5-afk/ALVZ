import { siteData } from "@/lib/site";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Données publiques : seulement le contenu déjà visible sur le site, lisible depuis alvzrec.com. */
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

/**
 * Contenu du site alvzrec.com (clips, photos, coulisses, matériel, WhatsApp), demandé par la page posée sur
 * l'ancien compte Netlify à chaque visite. Gardé 5 min par le CDN (un changement du studio apparaît en
 * quelques minutes) ; les adresses des photos (signées pour 2 à 3 h) restent valides pendant tout le cache.
 */
export async function GET() {
  try {
    return Response.json(await siteData(createServiceClient()), {
      headers: {
        ...CORS,
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Netlify-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch {
    // La page affiche alors son contenu d'origine.
    return Response.json({ error: "indisponible" }, { status: 503, headers: CORS });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
