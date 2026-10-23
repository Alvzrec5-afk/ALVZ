"use client";

import { useActionState } from "react";
import { acceptQuote } from "@/app/d/[slug]/actions";

export function AcceptForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(acceptQuote.bind(null, slug), null);
  if (state?.ok) return <p className="text-sm text-accent">Merci ! Votre accord est bien enregistré.</p>;
  return (
    <form action={action} className="space-y-5">
      <label className="block">
        <span className="label">Votre nom</span>
        <input name="name" className="field" autoComplete="name" required maxLength={120} />
      </label>
      <label className="flex items-start gap-3 text-sm cursor-pointer">
        <input type="checkbox" name="agree" className="mt-1 w-4 h-4 accent-current" required />
        <span>Bon pour accord : j&apos;accepte ce devis et ses conditions.</span>
      </label>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button className="btn w-full sm:w-auto" disabled={pending}>{pending ? "…" : "Accepter le devis"}</button>
    </form>
  );
}
