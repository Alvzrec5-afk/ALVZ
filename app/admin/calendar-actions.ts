"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireAdminApi } from "@/lib/auth";
import type { EventKind } from "@/lib/calendar";
import { confirmEvent, createAgreedQuote } from "@/lib/calendar-server";

type Result = { error?: string; ok?: string; id?: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}(:\d{2})?$/;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function refresh() {
  revalidatePath("/admin", "layout");
}

export type EventInput = {
  title: string;
  client_name: string;
  client_email: string;
  starts_on: string;
  ends_on: string;
  start_time: string;
  end_time: string;
  location: string;
  notes: string;
  kind: EventKind;
  want_photo: boolean;
  want_video: boolean;
  want_board: boolean;
  price_cents: number | null;
};

/** Ajoute (id null) ou modifie un événement. Un nouvel événement « prestation » commence en option. */
export async function saveEvent(id: string | null, input: EventInput, confirm = false): Promise<Result> {
  let confirmed = confirm;
  const { supabase } = await requireAdminApi();
  const title = text(input.title, 200) || text(input.client_name, 160);
  if (!title) return { error: "Donnez un titre (ou le nom du client)." };
  if (!DAY.test(input.starts_on)) return { error: "Choisissez une date." };
  const email = text(input.client_email, 160).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "L'adresse e-mail n'est pas valide." };
  const kind: EventKind = input.kind === "rdv" || input.kind === "autre" ? input.kind : "prestation";
  const ends = DAY.test(input.ends_on) && input.ends_on > input.starts_on ? input.ends_on : null;
  const row = {
    title,
    client_name: text(input.client_name, 160),
    client_email: email || null,
    starts_on: input.starts_on,
    ends_on: ends,
    start_time: TIME.test(input.start_time) ? input.start_time : null,
    end_time: TIME.test(input.end_time) ? input.end_time : null,
    location: text(input.location, 300),
    notes: text(input.notes, 4000),
    kind,
    want_photo: kind === "prestation" && Boolean(input.want_photo),
    want_video: kind === "prestation" && Boolean(input.want_video),
    want_board: kind === "prestation" && Boolean(input.want_board),
    price_cents: input.price_cents && input.price_cents > 0 ? Math.min(100_000_000, Math.round(input.price_cents)) : null,
    updated_at: new Date().toISOString(),
  };
  let eventId = id;
  if (id) {
    const { error } = await supabase.from("calendar_events").update(row).eq("id", id);
    if (error) return { error: error.message };
    // Projets déjà créés : la date suit.
    const { data: ev } = await supabase.from("calendar_events").select("gallery_id, video_id, status").eq("id", id).maybeSingle();
    const ids = [ev?.gallery_id, ev?.video_id].filter(Boolean) as string[];
    if (ids.length) await supabase.from("galleries").update({ event_date: row.starts_on }).in("id", ids);
    // Date déjà confirmée : ce qui vient d'être coché est créé tout de suite.
    if (ev?.status === "confirmed" && kind === "prestation") confirmed = true;
  } else {
    const { data, error } = await supabase
      .from("calendar_events")
      .insert({ ...row, status: kind === "prestation" ? "option" : "confirmed" })
      .select("id")
      .single();
    if (error) return { error: error.message };
    eventId = data.id as string;
  }
  if (confirmed && kind === "prestation" && eventId) {
    try {
      await confirmEvent(supabase, eventId);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Confirmation impossible", id: eventId };
    }
  }
  refresh();
  return { ok: confirm ? "Date confirmée, projets créés." : "Enregistré", id: eventId ?? undefined };
}

/** Le client a validé la date : galerie / projet vidéo / tableau / devis créés. */
export async function confirmEventAction(id: string): Promise<Result> {
  const { supabase } = await requireAdminApi();
  try {
    await confirmEvent(supabase, id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Confirmation impossible" };
  }
  refresh();
  return { ok: "Date confirmée, projets créés." };
}

export async function setEventStatus(id: string, status: "option" | "cancelled"): Promise<Result> {
  const { supabase } = await requireAdminApi();
  const { error } = await supabase.from("calendar_events").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

/** Retire l'événement du calendrier (les projets déjà créés restent). */
export async function deleteEvent(id: string): Promise<Result> {
  const { supabase } = await requireAdminApi();
  const { error } = await supabase.from("calendar_events").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

/**
 * Devis à envoyer au client pour une date en option (brouillon au prix convenu, relié à l'événement) :
 * quand le client l'accepte en ligne, la date est validée toute seule.
 */
export async function createEventQuote(id: string): Promise<Result> {
  const { supabase } = await requireAdminApi();
  const { data: ev } = await supabase.from("calendar_events").select("title, client_name, client_email, price_cents, quote_id, gallery_id, video_id").eq("id", id).maybeSingle();
  if (!ev) return { error: "Événement introuvable" };
  if (ev.quote_id) return { id: ev.quote_id as string };
  try {
    const quoteId = await createAgreedQuote(supabase, {
      title: (ev.title as string) || (ev.client_name as string),
      client_name: ev.client_name as string,
      client_email: ev.client_email as string | null,
      price_cents: Number(ev.price_cents ?? 0),
      gallery_id: (ev.gallery_id ?? ev.video_id ?? null) as string | null,
      status: "draft",
    });
    await supabase.from("calendar_events").update({ quote_id: quoteId }).eq("id", id);
    refresh();
    return { id: quoteId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Création du devis impossible" };
  }
}

/** Lien d'abonnement pour le Calendrier de l'iPhone / du Mac (créé la première fois). `renew` en crée un nouveau. */
export async function calendarFeedUrl(renew = false): Promise<Result & { url?: string }> {
  const { supabase } = await requireAdminApi();
  const { data } = await supabase.from("studio_settings").select("calendar_token").eq("id", 1).maybeSingle();
  let token = (data?.calendar_token as string | null) ?? null;
  if (!token || renew) {
    token = randomBytes(24).toString("base64url");
    const { error } = await supabase.from("studio_settings").update({ calendar_token: token }).eq("id", 1);
    if (error) return { error: error.message };
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return { url: `https://${host}/api/calendar/${token}` };
}
