import "server-only";
import ICAL from "ical.js";
import { unstable_cache } from "next/cache";
import { addDays, todayParis } from "@/lib/finance";

/** Événement lu dans un calendrier externe (iPhone / iCloud, Google…), en lecture seule. */
export type ImportedEvent = {
  uid: string;
  title: string;
  date: string;
  endDate: string | null;
  time: string | null;
  endTime: string | null;
  location: string;
  notes: string;
};

/** « webcal://… » (lien copié de l'iPhone) → « https://… » ; refuse les adresses locales ou non https. */
export function normalizeCalendarUrl(input: string) {
  const raw = input.trim().replace(/^webcals?:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || /^(\d+\.){3}\d+$/.test(host) || host.includes(":")) return null;
  return url.toString();
}

const parisParts = (d: Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};

/** Une occurrence → date / heure à Paris (journée entière : fin exclusive ramenée au dernier jour). */
function occurrence(uid: string, ev: ICAL.Event, start: ICAL.Time, end: ICAL.Time | null): ImportedEvent {
  const allDay = start.isDate;
  let date: string;
  let time: string | null = null;
  let endDate: string | null = null;
  let endTime: string | null = null;
  if (allDay) {
    date = start.toString().slice(0, 10);
    if (end) {
      const last = addDays(end.toString().slice(0, 10), -1);
      endDate = last > date ? last : null;
    }
  } else {
    const s = parisParts(start.toJSDate());
    date = s.date;
    time = s.time;
    if (end) {
      const e = parisParts(end.toJSDate());
      endTime = e.time;
      endDate = e.date > date ? e.date : null;
    }
  }
  return {
    uid,
    title: String(ev.summary || "Sans titre").slice(0, 200),
    date,
    endDate,
    time,
    endTime,
    location: String(ev.location ?? "").slice(0, 300),
    notes: String(ev.description ?? "").slice(0, 2000),
  };
}

/** Lit un fichier iCal et déplie les répétitions entre `from` et `to` (AAAA-MM-JJ). */
export function parseCalendar(text: string, from: string, to: string): ImportedEvent[] {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const tz of root.getAllSubcomponents("vtimezone")) {
    try {
      ICAL.TimezoneService.register(tz);
    } catch {}
  }
  const vevents = root.getAllSubcomponents("vevent");
  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const v of vevents) {
    if (String(v.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED") continue;
    const ev = new ICAL.Event(v);
    if (ev.isRecurrenceException()) exceptions.push(ev);
    else masters.set(ev.uid, ev);
  }
  for (const ex of exceptions) {
    const master = masters.get(ex.uid);
    if (master) master.relateException(ex);
  }

  const out: ImportedEvent[] = [];
  const inRange = (d: string, e: string | null) => (e ?? d) >= from && d <= to;
  for (const ev of masters.values()) {
    if (!ev.startDate) continue;
    if (!ev.isRecurring()) {
      const o = occurrence(ev.uid, ev, ev.startDate, ev.endDate ?? null);
      if (inRange(o.date, o.endDate)) out.push(o);
      continue;
    }
    const it = ev.iterator();
    for (let i = 0, next = it.next(); next && i < 1000; i++, next = it.next()) {
      const d = next.toString().slice(0, 10);
      if (d > to) break;
      const det = ev.getOccurrenceDetails(next);
      const o = occurrence(`${ev.uid}#${d}`, det.item, det.startDate, det.endDate ?? null);
      if (inRange(o.date, o.endDate)) out.push(o);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 2000);
}

/** Télécharge le calendrier (8 s max, 5 Mo max). */
async function download(url: string) {
  const res = await fetch(url, { headers: { accept: "text/calendar, */*" }, signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error(`Le calendrier ne répond pas (erreur ${res.status}). Vérifiez le lien et qu'il est bien partagé.`);
  const text = await res.text();
  if (text.length > 5_000_000) throw new Error("Calendrier trop gros.");
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("Ce lien n'est pas un calendrier (iCal).");
  return text;
}

/** Événements d'un calendrier externe, gardés 5 minutes (une ouverture du calendrier ne le retélécharge pas à chaque fois). */
export const importedEvents = unstable_cache(
  async (url: string, day: string) => parseCalendar(await download(url), addDays(day, -60), addDays(day, 400)),
  ["calendar-import-v1"],
  { revalidate: 300 },
);

/** Vérifie un lien avant de l'enregistrer : renvoie le nombre d'événements trouvés. */
export async function checkCalendar(url: string) {
  const day = todayParis();
  return parseCalendar(await download(url), addDays(day, -60), addDays(day, 400)).length;
}
