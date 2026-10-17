import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** Lien secret de galerie : 16 octets aléatoires (impossible à deviner). */
export function newSlug() {
  return randomBytes(16).toString("base64url");
}

function hmac(value: string) {
  return createHmac("sha256", env.gallerySecret()).update(value).digest("base64url");
}

export function sign(value: string) {
  return `${value}.${hmac(value)}`;
}

/** Renvoie la valeur si la signature est valide, sinon null. */
export function unsign(signed: string | undefined): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i <= 0) return null;
  const value = signed.slice(0, i);
  const a = Buffer.from(signed.slice(i + 1));
  const b = Buffer.from(hmac(value));
  return a.length === b.length && timingSafeEqual(a, b) ? value : null;
}
