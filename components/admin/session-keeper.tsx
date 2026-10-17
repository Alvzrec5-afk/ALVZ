"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/browser";

/** Garde la session admin à jour (renouvellement automatique du jeton dans le navigateur). */
export function SessionKeeper() {
  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange(() => {});
    supabase.auth.getSession();
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}
