import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Session lue une seule fois par requête. getClaims() contrôle la signature du jeton
 * sur place, sans aller-retour vers Supabase Auth.
 */
const getSession = cache(async () => {
  const supabase = await createSessionClient();
  const { data: auth } = await supabase.auth.getClaims();
  const id = auth?.claims?.sub;
  return { supabase, user: id ? { id } : null };
});

const isAdmin = cache(async (id: string) => {
  const { supabase } = await getSession();
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", id).maybeSingle();
  return Boolean(data);
});

async function getAdmin() {
  const { supabase, user } = await getSession();
  return { supabase, user, isAdmin: user ? await isAdmin(user.id) : false };
}

/**
 * Pour les pages admin : il faut être connecté. Le contrôle « est bien l'admin »
 * est fait par la mise en page (requireAdminLayout), rendue en même temps que la page :
 * les requêtes de la page partent sans attendre ce contrôle (une attente de moins),
 * et la base refuse de toute façon les données à un non-admin (règles RLS).
 */
export async function requireAdminPage() {
  const { supabase, user } = await getSession();
  if (!user) redirect("/admin/login");
  return { supabase, user };
}

/** Mise en page du studio : redirige si le compte connecté n'est pas l'admin. */
export async function requireAdminLayout() {
  const { user, isAdmin: admin } = await getAdmin();
  if (!user) redirect("/admin/login");
  if (!admin) redirect("/admin/login?error=not-admin");
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
