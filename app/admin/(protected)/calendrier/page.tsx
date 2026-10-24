import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { todayParis } from "@/lib/finance";
import { loadCalendar } from "@/lib/calendar-entries";
import { CalendarView } from "@/components/admin/calendar/calendar-view";

export const metadata = { title: "Calendrier" };
export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ e?: string; m?: string }> }) {
  const { supabase } = await requireAdminPage();
  const today = todayParis();
  const { entries, events: evs, sources } = await loadCalendar(supabase, today);

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
        sources={sources.map((s) => ({ id: s.id, name: s.name, count: s.events.length, error: s.error }))}
        initialMonth={/^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : today.slice(0, 7)}
      />
    </div>
  );
}
