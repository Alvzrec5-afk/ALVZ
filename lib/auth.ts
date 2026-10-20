import "server-only";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import type { JWK } from "@supabase/auth-js";
import { createSessionClient } from "@/lib/supabase/server";

/**
 * Clés publiques de Supabase Auth (pour vérifier la signature du jeton de connexion). Sans elles, chaque démarrage
 * d'une fonction Netlify les redemande à Supabase (jusqu'à 16 s quand Supabase rame). Ici elles sont gardées un jour
 * dans le cache de Next, partagé entre les démarrages (Netlify). Clé changée chez Supabase : getClaims ne la trouve
 * pas dans cette liste et va la chercher lui-même, comme avant. (unstable_cache plutôt que le cache de fetch, que les
 * pages en force-dynamic n'utilisent pas.)
 */
// L'adresse du projet fait partie de la clé du cache : un changement de projet Supabase ne reprend pas les anciennes clés.
const cachedKeys = unstable_cache(
  async (url: string) => {
    const res = await fetch(`${url}/auth/v1/.well-known/jwks.json`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { keys?: JWK[] };
    // Échec : erreur (jamais gardée en cache), on réessaiera à la prochaine demande.
    if (!res.ok || !Array.isArray(json.keys) || !json.keys.length) throw new Error("jwks indisponible");
    return json.keys;
  },
  ["supabase-jwks"],
  { revalidate: 86_400 },
);

async function signingKeys() {
  try {
    return await cachedKeys(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  } catch {
    return undefined;
  }
}

/**
 * Session lue une seule fois par requête. getClaims() contrôle la signature du jeton
 * sur place, sans aller-retour vers Supabase Auth.
 */
const getSession = cache(async () => {
  const [supabase, keys] = await Promise.all([createSessionClient(), signingKeys()]);
  const { data: auth } = await supabase.auth.getClaims(undefined, keys ? { keys } : undefined);
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

/** Le visiteur est-il le studio connecté ? (sans redirection, pour les pages publiques) */
export async function isStudioSession() {
  try {
    const { user, isAdmin } = await getAdmin();
    return Boolean(user && isAdmin);
  } catch {
    return false;
  }
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

/**
 * Routes API admin : le contrôle « est bien l'admin » part en même temps que `work` (un aller-retour
 * de moins vers la base, en Irlande). Sans risque : les règles RLS refusent de toute façon lectures et
 * écritures à un compte qui n'est pas l'admin ; le résultat n'est rendu qu'après le contrôle.
 */
export async function adminApiWith<T>(work: (supabase: Awaited<ReturnType<typeof createSessionClient>>) => PromiseLike<T>) {
  const { supabase, user } = await getSession();
  if (!user) throw new HttpError(401, "Non connecté");
  const [admin, result] = await Promise.all([isAdmin(user.id), work(supabase)]);
  if (!admin) throw new HttpError(403, "Accès refusé");
  return { supabase, user, result };
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
