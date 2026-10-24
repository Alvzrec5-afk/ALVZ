import { requireAdminPage } from "@/lib/auth";
import type { Contact } from "@/lib/contact";
import { loadCalendar } from "@/lib/calendar-entries";
import { addDays, quoteState, todayParis, type FinanceSettings } from "@/lib/finance";
import { loadQuotes } from "@/lib/finance-data";
import { storageUsage, studioOverview } from "@/lib/usage";
import { HomeCockpit, type CockpitData } from "@/components/admin/home-cockpit";

export const metadata = { title: "Accueil" };
export const dynamic = "force-dynamic";

const MONTH_LABEL = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTH_NAME = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/** Accueil du studio (« cockpit ») : argent, prochaines dates, objectif du mois, derniers paiements, puis le stockage. */
export default async function StudioHome() {
  const { supabase } = await requireAdminPage();
  const today = todayParis();
  const month = today.slice(0, 7);
  const finance = loadQuotes(supabase);
  const [o, usage, { data: galleries }, { data: boards }, { data: settings }, money] = await Promise.all([
    studioOverview(supabase),
    storageUsage(supabase),
    supabase.from("galleries").select("id, title, kind").is("deleted_at", null).order("updated_at", { ascending: false }),
    supabase.from("boards").select("id, title").is("parent_id", null).is("deleted_at", null).eq("is_template", false).eq("is_library", false).order("updated_at", { ascending: false }),
    supabase.from("studio_settings").select("finance, contact").eq("id", 1).maybeSingle(),
    finance,
  ]);
  const cal = await loadCalendar(supabase, today, money);
  const { quotes, paid, payments } = money;
  const f = (settings?.finance ?? {}) as FinanceSettings;
  const contact = (settings?.contact ?? {}) as Contact;

  // Encaissé : les 6 derniers mois (le plus ancien d'abord).
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 - (5 - i), 1));
    return d.toISOString().slice(0, 7);
  });
  const income = months.map((m) => payments.filter((p) => p.paid_on.startsWith(m)).reduce((s, p) => s + p.amount_cents, 0));
  const thisMonth = income[5];
  const lastMonth = income[4];

  // À encaisser : devis acceptés pas entièrement payés.
  const accepted = quotes.filter((q) => q.status === "accepted").map((q) => ({ q, s: quoteState(q, paid.get(q.id) ?? 0, today) })).filter((x) => x.s.remaining > 0);
  const toCollect = accepted.reduce((s, x) => s + x.s.remaining, 0);
  const overdue = accepted.filter((x) => x.s.overdue);
  const dueThisMonth = accepted.filter((x) => x.q.due_on?.startsWith(month)).reduce((s, x) => s + x.s.remaining, 0);

  // Dates à venir (événements du studio).
  const upcoming = cal.events.filter((e) => e.status !== "cancelled" && (e.ends_on ?? e.starts_on) >= today);
  const options = upcoming.filter((e) => e.status === "option" && e.kind === "prestation");
  const next = upcoming.filter((e) => e.kind === "prestation").sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0] ?? null;
  const weekEnd = addDays(today, 6);
  const thisWeek = upcoming.filter((e) => e.kind === "prestation" && e.status === "confirmed" && e.starts_on <= weekEnd).length;

  const horizon = addDays(today, 13);
  const agenda = cal.entries
    .filter((e) => e.tone !== "cancelled" && (e.endDate ?? e.date) >= today && e.date <= horizon)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "99").localeCompare(b.time ?? "99"))
    .slice(0, 9);

  const byId = new Map(quotes.map((q) => [q.id, q]));
  const lastPayments = [...payments]
    .sort((a, b) => b.paid_on.localeCompare(a.paid_on) || (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 4)
    .map((p) => {
      const q = byId.get(p.quote_id);
      return { id: p.id, date: p.paid_on, label: [q?.client_name || q?.title || q?.number, p.note].filter(Boolean).join(" — "), cents: p.amount_cents, href: `/admin/finances/devis/${p.quote_id}` };
    });

  const data: CockpitData = {
    today,
    name: (f.owner_name || contact.name || "").split(/\s+/)[0]?.replace(/[^\p{L}-]/gu, "") ?? "",
    summary: { week: thisWeek, overdue: overdue.length, options: options.length },
    monthName: MONTH_NAME[Number(month.slice(5, 7)) - 1],
    income: { cents: thisMonth, prev: lastMonth, spark: income, labels: months.map((m) => MONTH_LABEL[Number(m.slice(5, 7)) - 1]) },
    toCollect: { cents: toCollect, count: accepted.length, overdue: overdue.length },
    options: { cents: options.reduce((s, e) => s + (e.price_cents ?? 0), 0), count: options.length },
    next: next ? { title: next.title, date: next.starts_on, days: daysBetween(today, next.starts_on), option: next.status === "option", id: next.id } : null,
    agenda,
    goal: f.monthly_goal ? { cents: f.monthly_goal * 100, done: thisMonth, dueThisMonth } : null,
    payments: lastPayments,
  };

  return (
    <HomeCockpit
      data={data}
      o={o}
      usage={usage}
      galleries={(galleries ?? []).map((g) => ({ id: g.id as string, title: g.title as string, kind: g.kind as string }))}
      boards={(boards ?? []).map((b) => ({ id: b.id as string, title: b.title as string }))}
    />
  );
}
