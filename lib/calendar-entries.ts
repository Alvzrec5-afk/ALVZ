import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENT_FIELDS, type CalendarEntry, type CalendarEvent } from "@/lib/calendar";
import { importedEvents } from "@/lib/calendar-import";
import { addDays, formatCents, quoteState, type Payment, type Quote } from "@/lib/finance";
import { loadQuotes } from "@/lib/finance-data";

/**
 * Tout ce qui s'affiche dans le calendrier (Calendrier et Accueil) : événements du studio, galeries datées hors calendrier,
 * calendriers importés (iPhone, Google) et soldes à recevoir. Renvoie aussi les devis lus, pour ne pas les relire.
 */
export async function loadCalendar(supabase: SupabaseClient, today: string, preloaded?: { quotes: Quote[]; paid: Map<string, number>; payments: Payment[] }) {
  const since = addDays(today, -400);
  const [{ data: events }, { data: galleries }, { quotes, paid }, { data: sourceRows }] = await Promise.all([
    supabase.from("calendar_events").select(EVENT_FIELDS).is("deleted_at", null).gte("starts_on", since).order("starts_on"),
    supabase.from("galleries").select("id, title, kind, event_date").is("deleted_at", null).not("event_date", "is", null).gte("event_date", since),
    preloaded ?? loadQuotes(supabase),
    supabase.from("calendar_sources").select("id, name, url").order("created_at"),
  ]);
  // Calendriers importés (iPhone, Google) : lus en parallèle ; un lien en panne n'empêche pas le reste de s'afficher.
  const sources = await Promise.all(
    (sourceRows ?? []).map(async (s) => {
      try {
        return { id: s.id as string, name: s.name as string, events: await importedEvents(s.url as string, today), error: null };
      } catch (e) {
        return { id: s.id as string, name: s.name as string, events: [], error: e instanceof Error ? e.message : "Calendrier illisible" };
      }
    }),
  );
  const evs = ((events ?? []) as CalendarEvent[]).map((e) => ({ ...e, price_cents: e.price_cents === null ? null : Number(e.price_cents) }));
  const linked = new Set(evs.flatMap((e) => [e.gallery_id, e.video_id]).filter(Boolean));
  const taken = new Set((await supabase.from("calendar_events").select("external_uid").not("external_uid", "is", null).is("deleted_at", null)).data?.map((r) => r.external_uid as string));

  const entries: CalendarEntry[] = [
    ...evs.map((e) => ({
      key: `ev-${e.id}`,
      date: e.starts_on,
      endDate: e.ends_on,
      time: e.start_time,
      title: e.title,
      sub: [e.client_name !== e.title ? e.client_name : "", e.price_cents ? formatCents(e.price_cents, true) : ""].filter(Boolean).join(" · ") || undefined,
      tone: (e.status === "cancelled" ? "cancelled" : e.status === "option" ? "option" : e.kind === "prestation" ? "event" : "project") as CalendarEntry["tone"],
      eventId: e.id,
    })),
    // Galeries et projets vidéo datés, créés hors du calendrier.
    ...(galleries ?? [])
      .filter((g) => !linked.has(g.id))
      .map((g) => ({
        key: `g-${g.id}`,
        date: g.event_date as string,
        title: g.title as string,
        sub: g.kind === "video" ? "Projet vidéo" : "Galerie",
        tone: "project" as const,
        href: `/admin/galleries/${g.id}`,
      })),
    // Événements importés, sauf ceux déjà repris dans le studio.
    ...sources.flatMap((s) =>
      s.events
        .filter((e) => !taken.has(e.uid))
        .map((e) => ({
          key: `x-${s.id}-${e.uid}`,
          date: e.date,
          endDate: e.endDate,
          time: e.time ? `${e.time}:00` : null,
          title: e.title,
          sub: s.name,
          tone: "external" as const,
          external: { ...e, source: s.name },
        })),
    ),
    // Soldes à recevoir (devis acceptés avec une date limite).
    ...quotes
      .filter((q) => q.status === "accepted" && q.due_on)
      .flatMap((q) => {
        const s = quoteState(q, paid.get(q.id) ?? 0, today);
        if (s.remaining <= 0) return [];
        return [
          {
            key: `due-${q.id}`,
            date: q.due_on!,
            title: `Solde ${formatCents(s.remaining, true)}`,
            sub: q.client_name || q.title || q.number,
            tone: (s.overdue ? "overdue" : "due") as CalendarEntry["tone"],
            href: `/admin/finances/devis/${q.id}`,
          },
        ];
      }),
  ];

  return { entries, events: evs, sources, quotes, paid };
}
