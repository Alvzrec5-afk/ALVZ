/** Format iCalendar (.ics) pour l'abonnement au calendrier du studio. */
import { addDays } from "@/lib/finance";

/** Texte d'un champ iCalendar (virgules, points-virgules et retours à la ligne protégés). */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const day = (d: string) => d.replaceAll("-", "");
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

/** Lignes de plus de 75 octets repliées (règle du format). */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

export type Vevent = { uid: string; date: string; end?: string | null; start?: string | null; finish?: string | null; summary: string; description?: string; location?: string; tentative?: boolean; cancelled?: boolean; url?: string };

export function vevent(e: Vevent) {
  const lines = ["BEGIN:VEVENT", `UID:${e.uid}@alvzgalleries.com`, `DTSTAMP:${stamp()}`];
  if (e.start) {
    const hm = (t: string) => t.slice(0, 5).replace(":", "") + "00";
    lines.push(`DTSTART;TZID=Europe/Paris:${day(e.date)}T${hm(e.start)}`);
    lines.push(`DTEND;TZID=Europe/Paris:${day(e.end ?? e.date)}T${hm(e.finish ?? e.start.replace(/^(\d{2})/, (h) => String(Math.min(23, Number(h) + 1)).padStart(2, "0")))}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${day(e.date)}`, `DTEND;VALUE=DATE:${day(addDays(e.end ?? e.date, 1))}`);
  }
  lines.push(`SUMMARY:${esc(e.summary)}`);
  if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
  if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
  if (e.url) lines.push(`URL:${e.url}`);
  if (e.tentative) lines.push("STATUS:TENTATIVE");
  if (e.cancelled) lines.push("STATUS:CANCELLED");
  lines.push("END:VEVENT");
  return lines.map(fold).join("\r\n");
}

/** Fichier complet (abonnement « ALVZ Studio », rafraîchi toutes les heures par l'appareil). */
export function calendarFile(events: string[]) {
  return (
    ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ALVZ Studio//Calendrier//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:ALVZ Studio", "X-WR-TIMEZONE:Europe/Paris", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H", ...events, "END:VCALENDAR"].join("\r\n") + "\r\n"
  );
}
