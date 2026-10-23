/** Calendrier du studio : types et petits calculs partagés (studio, abonnement iPhone). */

export type EventKind = "prestation" | "rdv" | "autre";
export type EventStatus = "option" | "confirmed" | "cancelled";

export type CalendarEvent = {
  id: string;
  title: string;
  client_name: string;
  client_email: string | null;
  starts_on: string;
  ends_on: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string;
  notes: string;
  kind: EventKind;
  status: EventStatus;
  want_photo: boolean;
  want_video: boolean;
  price_cents: number | null;
  quote_id: string | null;
  gallery_id: string | null;
  video_id: string | null;
  board_id: string | null;
  confirmed_at: string | null;
};

export const EVENT_FIELDS =
  "id, title, client_name, client_email, starts_on, ends_on, start_time, end_time, location, notes, kind, status, want_photo, want_video, price_cents, quote_id, gallery_id, video_id, board_id, confirmed_at";

export const KIND_LABEL: Record<EventKind, string> = { prestation: "Prestation", rdv: "Rendez-vous", autre: "Autre" };
export const STATUS_LABEL: Record<EventStatus, string> = { option: "Option (pas sûr)", confirmed: "Confirmé", cancelled: "Annulé" };

/** Élément affiché dans le calendrier : un événement, ou une date venue d'ailleurs (galerie, échéance de paiement). */
export type CalendarEntry = {
  key: string;
  date: string;
  endDate?: string | null;
  time?: string | null;
  title: string;
  sub?: string;
  tone: "event" | "option" | "project" | "due" | "overdue" | "cancelled";
  href?: string;
  eventId?: string;
};

/** « 14:30:00 » → « 14 h 30 » ; « 09:00:00 » → « 9 h ». */
export function formatTime(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":");
  return `${Number(h)} h${m && m !== "00" ? ` ${m}` : ""}`;
}

/** Jours d'un mois en grille (lundi en premier), avec les jours du mois d'avant / d'après pour compléter. */
export function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const days: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  // 5 semaines suffisent souvent.
  return days[35].slice(5, 7) === String(month + 1).padStart(2, "0") ? days : days.slice(0, 35);
}
