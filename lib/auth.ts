import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Vérifie la session une seule fois par requête (la mise en page et la page la partagent).
 * getClaims() contrôle la signature du jeton sur place, sans aller-retour vers Supabase Auth.
 */
const getAdmin = cache(async () => {
  const supabase = await createSessionClient();
  const { data: auth } = await supabase.auth.getClaims();
  const id = auth?.claims?.sub;
  if (!id) return { supabase, user: null, isAdmin: false };
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", id).maybeSingle();
  return { supabase, user: { id }, isAdmin: Boolean(data) };
});

/** Pour les pages admin : redirige vers la connexion si besoin. */
export async function requireAdminPage() {
  const { supabase, user, isAdmin } = await getAdmin();
  if (!user) redirect("/admin/login");
  if (!isAdmin) redirect("/admin/login?error=not-admin");
  return { supabase, user };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Pour les routes API admin : lève une erreur 401/403. */
export async function requireAdminApi() {
  const { supabase, user, isAdmin } = await getAdmin();
  if (!user) throw new HttpError(401, "Non connecté");
  if (!isAdmin) throw new HttpError(403, "Accès refusé");
  return { supabase, user };
}

export function apiError(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  const message = error instanceof Error ? error.message : "Erreur inconnue";
  return Response.json({ error: message }, { status: 500 });
}
