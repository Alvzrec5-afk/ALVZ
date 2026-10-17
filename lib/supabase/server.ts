import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/** Client lié à la session de l'admin : toutes les requêtes passent par les règles RLS. */
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl(), env.supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appelé depuis un Server Component : le navigateur rafraîchit la session lui-même.
        }
      },
    },
  });
}

/**
 * Client « service » qui contourne RLS. Utilisé UNIQUEMENT côté serveur pour les
 * galeries clients, après vérification du lien secret, du mot de passe et de l'expiration.
 */
export function createServiceClient() {
  return createSupabaseClient(env.supabaseUrl(), env.supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
