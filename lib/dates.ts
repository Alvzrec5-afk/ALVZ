/** Fin de journée (23:59:59) à Paris pour une date "AAAA-MM-JJ", en ISO UTC. */
export function parisEndOfDay(date: string) {
  const probe = new Date(`${date}T12:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "longOffset" })
    .formatToParts(probe)
    .find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";
  return new Date(`${date}T23:59:59${offset === "" ? "+00:00" : offset}`).toISOString();
}

/** Date ISO → "AAAA-MM-JJ" (jour à Paris), pour pré-remplir un champ date. */
export function toParisDateInput(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(iso));
}

export function formatLongDate(date: string | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
