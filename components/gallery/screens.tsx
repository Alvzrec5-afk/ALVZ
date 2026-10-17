"use client";

import { useActionState } from "react";
import { unlockGallery } from "@/app/g/[slug]/actions";
import { LockIcon } from "@/components/icons";
import { Wordmark } from "@/components/wordmark";
import type { ColorTheme, FontStyle } from "@/lib/design";

function Shell({ theme, children }: { theme: ColorTheme; children: React.ReactNode }) {
  return (
    <div data-theme={theme} className="min-h-svh bg-bg text-ink flex flex-col items-center justify-center px-6 text-center">
      <Wordmark height={48} className="absolute top-8" />
      {children}
    </div>
  );
}

export function ExpiredScreen({ theme }: { theme: ColorTheme }) {
  return (
    <Shell theme={theme}>
      <p className="eyebrow text-muted mb-6">Galerie</p>
      <h1 className="display text-5xl sm:text-6xl">Galerie expirée</h1>
      <p className="mt-8 text-sm text-muted max-w-xs leading-relaxed">
        Cette galerie n&apos;est plus disponible. Pour y accéder à nouveau, contactez ALVZ.REC.
      </p>
    </Shell>
  );
}

export function LockScreen({ slug, title, theme, fontStyle }: { slug: string; title: string; theme: ColorTheme; fontStyle: FontStyle }) {
  const [state, action, pending] = useActionState(unlockGallery.bind(null, slug), null);
  return (
    <Shell theme={theme}>
      <LockIcon className="w-5 h-5 text-muted mb-8" />
      <h1 className={`fs-${fontStyle} gallery-title text-4xl sm:text-6xl break-words max-w-2xl`}>{title}</h1>
      <form action={action} className="mt-14 w-full max-w-xs space-y-6">
        <label className="label" htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" autoFocus autoComplete="current-password" required className="field text-center" />
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? "…" : "Entrer"}</button>
      </form>
    </Shell>
  );
}
