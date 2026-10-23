import { timingSafeEqual } from "node:crypto";
import { EVENT_FIELDS, KIND_LABEL, type CalendarEvent } from "@/lib/calendar";
import { addDays, formatCents, todayParis } from "@/lib/finance";
import { calendarFile, vevent } from "@/lib/ical";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Abonnement « Calendrier » (iPhone, Mac, Google) : lien secret, lecture seule, mis à jour par l'appareil.
 * Prestations (options marquées « à confirmer »), rendez-vous, galeries datées et soldes à recevoir.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/, "");
  const db = createServiceClient();
  const { data: s } = await db.from("studio_settings").select("calendar_token").eq("id", 1).maybeSingle();
  const expected = (s?.calendar_token as string | null) ?? "";
  const ok = expected.length > 0 && expected.length === token.length && timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  if (!ok) return new Response("Introuvable", { status: 404 });

  const origin = new URL(req.url).origin;
  const since = addDays(todayParis(), -400);
  const [{ data: events }, { data: galleries }, { data: quotes }, { data: payments }] = await Promise.all([
    db.from("calendar_events").select(EVENT_FIELDS).is("deleted_at", null).gte("starts_on", since),
    db.from("galleries").select("id, title, kind, event_date").is("deleted_at", null).not("event_date", "is", null).gte("event_date", since),
    db.from("quotes").select("id, number, title, client_name, total_cents, due_on, status").is("deleted_at", null).eq("status", "accepted").not("due_on", "is", null),
    db.from("quote_payments").select("quote_id, amount_cents"),
  ]);
  const evs = (events ?? []) as CalendarEvent[];
  const linked = new Set(evs.flatMap((e) => [e.gallery_id, e.video_id]).filter(Boolean));
  const paid = new Map<string, number>();
  for (const p of payments ?? []) paid.set(p.quote_id as string, (paid.get(p.quote_id as string) ?? 0) + Number(p.amount_cents));

  const items: string[] = [];
  for (const e of evs) {
    const prefix = e.status === "option" ? "Option · " : "";
    const what = [e.want_photo && "photo", e.want_video && "vidéo", e.want_board && "tableau"].filter(Boolean).join(" + ");
    items.push(
      vevent({
        uid: `ev-${e.id}`,
        date: e.starts_on,
        end: e.ends_on,
        start: e.start_time,
        finish: e.end_time,
        summary: `${prefix}${e.title}`,
        description: [KIND_LABEL[e.kind] + (what ? ` ${what}` : ""), e.client_name && `Client : ${e.client_name}`, e.price_cents ? `Prix : ${formatCents(e.price_cents)}` : null, e.notes]
          .filter(Boolean)
          .join("\n"),
        location: e.location,
        tentative: e.status === "option",
        cancelled: e.status === "cancelled",
        url: `${origin}/admin/calendrier?e=${e.id}`,
      }),
    );
  }
  for (const g of galleries ?? []) {
    if (linked.has(g.id)) continue;
    items.push(vevent({ uid: `g-${g.id}`, date: g.event_date as string, summary: `${g.kind === "video" ? "🎬" : "📷"} ${g.title}`, url: `${origin}/admin/galleries/${g.id}` }));
  }
  for (const q of quotes ?? []) {
    const rest = Number(q.total_cents) - (paid.get(q.id as string) ?? 0);
    if (rest <= 0) continue;
    items.push(
      vevent({
        uid: `due-${q.id}`,
        date: q.due_on as string,
        summary: `💶 Solde ${formatCents(rest)} — ${q.client_name || q.title || q.number}`,
        url: `${origin}/admin/finances/devis/${q.id}`,
      }),
    );
  }

  return new Response(calendarFile(items), {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=600", "content-disposition": 'inline; filename="alvz-studio.ics"' },
  });
}
