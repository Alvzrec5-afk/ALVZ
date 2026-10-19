import { fillSiteHtml, siteData } from "@/lib/site";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Le site alvzrec.com servi par le studio (aperçu : alvzgalleries.com/site), contenu déjà dans la page.
 * Gardé 5 min par le CDN de Netlify puis rafraîchi en arrière-plan ; les adresses des photos (signées pour
 * 2 à 3 h) restent valides pendant toute la durée du cache.
 */
export async function GET() {
  const html = fillSiteHtml(await siteData(createServiceClient()));
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
