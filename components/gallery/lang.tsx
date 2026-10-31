"use client";

/** Langue des pages clients, transmise une fois par la page (galerie, vidéo) à tous ses éléments. */
import { createContext, useContext, useEffect, useMemo } from "react";
import { translator, type Lang } from "@/lib/i18n";

const LangContext = createContext<Lang>("fr");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  // Pour le navigateur (traduction automatique, lecteurs d'écran).
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** `const t = useT(); t("download")` — français par défaut (studio). */
export function useT() {
  const lang = useContext(LangContext);
  return useMemo(() => translator(lang), [lang]);
}
