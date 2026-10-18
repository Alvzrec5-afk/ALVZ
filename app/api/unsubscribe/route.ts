import type { NextRequest } from "next/server";
import { readUnsubscribeToken } from "@/lib/audience";
import { createServiceClient } from "@/lib/supabase/server";

/** Désinscription en un clic (bouton « Se désinscrire » de Gmail, Apple Mail…). */
export async function POST(req: NextRequest) {
  const email = readUnsubscribeToken(req.nextUrl.searchParams.get("t") ?? undefined);
  if (!email) return new Response("Lien invalide", { status: 400 });
  await createServiceClient().from("mail_unsubscribes").upsert({ email }, { onConflict: "email" });
  return new Response("OK");
}
