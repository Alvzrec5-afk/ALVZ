import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { EVENT_FIELDS, type CalendarEntry, type CalendarEvent } from "@/lib/calendar";
import { addDays, formatCents, quoteState, todayParis } from "@/lib/finance";
import { loadQuotes } from "@/lib/finance-data";
import { CalendarView } from "@/components/admin/calendar/calendar-view";

export const metadata = { title: "Calendrier" };
export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ e?: string; m?: string }> }) {
  const { supabase } = await requireAdminPage();
  const today = todayParis();
  const since = addDays(today, -400);
  const [{ data: events }, { data: galleries }, { quotes, paid }] = await Promise.all([
    supabase.from("calendar_events").select(EVENT_FIELDS).is("deleted_at", null).gte("starts_on", since).order("starts_on"),
    supabase.from("galleries").select("id, title, kind, event_date").is("deleted_at", null).not("event_date", "is", null).gte("event_date", since),
    loadQuotes(supabase),
  ]);
  const evs = ((events ?? []) as CalendarEvent[]).map((e) => ({ ...e, price_cents: e.price_cents === null ? null : Number(e.price_cents) }));
  const linked = new Set(evs.flatMap((e) => [e.gallery_id, e.video_id]).filter(Boolean));

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

  const sp = await searchParams;
  return (
    <div className="max-w-6xl">
      <Link href="/admin" className="eyebrow text-muted hover:text-ink lg:hidden">← Accueil</Link>
      <h1 className="display text-4xl sm:text-5xl mt-6 lg:mt-0">Calendrier</h1>
      <CalendarView
        today={today}
        entries={entries}
        events={evs}
        openId={sp.e && evs.some((e) => e.id === sp.e) ? sp.e : null}
        initialMonth={/^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : today.slice(0, 7)}
      />
    </div>
  );
}
