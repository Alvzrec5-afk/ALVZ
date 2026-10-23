import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { QUOTE_FIELDS, type FinanceSettings, type Quote } from "@/lib/finance";
import { createServiceClient } from "@/lib/supabase/server";
import { QuoteDocument } from "@/components/quote/quote-document";

export const dynamic = "force-dynamic";

const load = cache(async (slug: string) => {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(slug)) return null;
  const db = createServiceClient();
  const { data } = await db.from("quotes").select(QUOTE_FIELDS).eq("share_slug", slug).is("deleted_at", null).maybeSingle();
  // Un brouillon n'est pas encore montré au client.
  if (!data || data.status === "draft") return null;
  const q = { ...(data as Quote), total_cents: Number(data.total_cents), vat_rate: Number(data.vat_rate) };
  const [{ data: pays }, { data: settings }] = await Promise.all([
    db.from("quote_payments").select("amount_cents").eq("quote_id", q.id),
    db.from("studio_settings").select("finance").eq("id", 1).maybeSingle(),
  ]);
  const paid = (pays ?? []).reduce((s, p) => s + Number(p.amount_cents), 0);
  return { q, paid, f: (settings?.finance ?? {}) as FinanceSettings };
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await load((await params).slug);
  return { title: d ? `Devis ${d.q.number}` : "Devis", robots: { index: false, follow: false } };
}

/** Page du devis pour le client (lien secret). */
export default async function QuotePublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  return <QuoteDocument q={d.q} paid={d.paid} f={d.f} slug={slug} />;
}
