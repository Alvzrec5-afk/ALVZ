import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { duplicateBoard, templateBoardId } from "@/lib/boards";
import { EVENT_FIELDS, type CalendarEvent } from "@/lib/calendar";
import { addDays, todayParis, type FinanceSettings } from "@/lib/finance";
import { nextQuoteNumber } from "@/lib/finance-data";
import { newSlug } from "@/lib/tokens";

/** Réglages de départ d'une galerie ou d'un projet vidéo (mêmes que « Nouvelle galerie »). */
export const NEW_PROJECT_DESIGN = { grid_style: "columns", grid_size: "large", cover_layout: "center", font_style: "sans" };

/** Crée une galerie photo (avec sa collection « Galerie ») ou un projet vidéo. */
export async function createProject(db: SupabaseClient, kind: "photo" | "video", title: string, eventDate: string | null) {
  const { data, error } = await db
    .from("galleries")
    .insert({ kind, title, event_date: eventDate, slug: newSlug(), design: NEW_PROJECT_DESIGN })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (kind === "photo") await db.from("collections").insert({ gallery_id: data.id, name: "Galerie", position: 0 });
  return data.id as string;
}

/** Devis « prix convenu » : une ligne au prix dit au client, déjà accepté (rien à envoyer). */
export async function createAgreedQuote(
  db: SupabaseClient,
  q: { title: string; client_name?: string; client_email?: string | null; price_cents: number; gallery_id: string | null; status?: "draft" | "accepted" },
) {
  const { data: s } = await db.from("studio_settings").select("finance").eq("id", 1).maybeSingle();
  const finance = (s?.finance ?? {}) as FinanceSettings;
  const vat = finance.vat_mode === "vat" ? (finance.vat_rate ?? 20) : 0;
  const ht = vat ? Math.round(q.price_cents / (1 + vat / 100)) : q.price_cents; // le prix convenu est le prix payé par le client
  const today = todayParis();
  const accepted = (q.status ?? "accepted") === "accepted";
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db
      .from("quotes")
      .insert({
        number: await nextQuoteNumber(db, today.slice(0, 4)),
        title: q.title,
        client_name: q.client_name ?? "",
        client_email: q.client_email || null,
        gallery_id: q.gallery_id,
        lines: [{ label: q.title, qty: 1, unit_cents: ht }],
        vat_rate: vat,
        total_cents: q.price_cents,
        deposit_pct: finance.deposit_pct ?? 30,
        status: accepted ? "accepted" : "draft",
        accepted_at: accepted ? new Date().toISOString() : null,
        issued_on: today,
        valid_until: addDays(today, finance.validity_days ?? 30),
        share_slug: newSlug(),
      })
      .select("id")
      .single();
    if (!error) return data.id as string;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Impossible de numéroter le devis, réessayez.");
}

/**
 * Date validée : crée ce qui est coché et manque encore (galerie photo, projet vidéo, tableau copié du modèle, devis au prix convenu),
 * puis marque l'événement « confirmé ». Peut être relancée sans rien créer en double.
 */
export async function confirmEvent(db: SupabaseClient, eventId: string) {
  const { data } = await db.from("calendar_events").select(EVENT_FIELDS).eq("id", eventId).is("deleted_at", null).maybeSingle();
  if (!data) throw new Error("Événement introuvable");
  const ev = data as CalendarEvent;
  const patch: Partial<CalendarEvent> & { updated_at: string } = { updated_at: new Date().toISOString() };
  const title = ev.title || ev.client_name || "Projet";

  if (ev.want_photo && !ev.gallery_id) patch.gallery_id = await createProject(db, "photo", title, ev.starts_on);
  if (ev.want_video && !ev.video_id) patch.video_id = await createProject(db, "video", title, ev.starts_on);
  const videoId = patch.video_id ?? ev.video_id;
  if (ev.want_board && !ev.board_id) {
    // Tableau copié du modèle, relié au projet vidéo (sinon à la galerie photo).
    const boardId = await duplicateBoard(db, await templateBoardId(db), title, { parentId: null });
    const owner = videoId ?? patch.gallery_id ?? ev.gallery_id;
    if (owner) await db.from("boards").update({ gallery_id: owner }).eq("id", boardId);
    patch.board_id = boardId;
  }
  const mainProject = patch.gallery_id ?? ev.gallery_id ?? videoId ?? null;
  if (ev.quote_id) {
    // Devis déjà fait (envoyé au client) : on le relie au projet s'il ne l'est pas encore.
    if (mainProject) await db.from("quotes").update({ gallery_id: mainProject }).eq("id", ev.quote_id).is("gallery_id", null);
  } else if (ev.price_cents && ev.price_cents > 0) {
    patch.quote_id = await createAgreedQuote(db, { title, client_name: ev.client_name, client_email: ev.client_email, price_cents: ev.price_cents, gallery_id: mainProject });
  }
  if (ev.status !== "confirmed") Object.assign(patch, { status: "confirmed", confirmed_at: new Date().toISOString() });
  const { error } = await db.from("calendar_events").update(patch).eq("id", ev.id);
  if (error) throw new Error(error.message);
  return { ...ev, ...patch } as CalendarEvent;
}

/** Le client a accepté un devis relié à un événement en option : la date est validée. */
export async function confirmEventsForQuote(db: SupabaseClient, quoteId: string) {
  const { data } = await db.from("calendar_events").select("id").eq("quote_id", quoteId).eq("status", "option").is("deleted_at", null);
  for (const e of data ?? []) {
    try {
      await confirmEvent(db, e.id as string);
    } catch (err) {
      console.error("Confirmation automatique de l'événement impossible", err);
    }
  }
}
