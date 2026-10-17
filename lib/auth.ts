import "server-only";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";

async function getAdmin() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return { supabase, user, isAdmin: Boolean(data) };
}

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
