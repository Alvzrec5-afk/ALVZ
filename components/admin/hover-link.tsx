"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * Lien du studio préparé au survol (souris) ou au toucher, pas dès qu'il apparaît à l'écran : la page commence à
 * charger juste avant le clic, sans lancer une demande au serveur pour chaque lien visible (Accueil, listes…).
 */
export function HoverLink({ href, onMouseEnter, onFocus, onTouchStart, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter();
  const warm = () => router.prefetch(href);
  return (
    <Link
      {...rest}
      href={href}
      prefetch={false}
      onMouseEnter={(e) => {
        warm();
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        warm();
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        warm();
        onTouchStart?.(e);
      }}
    />
  );
}
