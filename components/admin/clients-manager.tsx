"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AudienceMember } from "@/lib/audience";

export type Campaign = { id: string; subject: string; recipients: number; sent: number; failed: number; created_at: string };

const BATCH = 10;
const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });

const DEFAULT_SUBJECT = "Merci pour votre confiance";
const DEFAULT_BODY = `Bonjour,

Vous avez récemment utilisé nos services et je tenais à vous remercier pour votre confiance.

J'en profite pour vous transmettre mon site et mes coordonnées : n'hésitez pas à me contacter pour vos prochains projets (mariage, portrait, événement…) ou à me recommander autour de vous.

À très bientôt !`;

export function ClientsManager({ audience, campaigns, configured }: { audience: AudienceMember[]; campaigns: Campaign[]; configured: boolean }) {
  const router = useRouter();
  const reachable = audience.filter((m) => !m.unsubscribed);
  const [selected, setSelected] = useState(() => new Set(reachable.map((m) => m.email)));
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: string[] } | null>(null);
  const [busy, setBusy] = useState<"test" | "send" | null>(null);
  const [notice, setNotice] = useState<{ ok?: string; error?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? audience.filter((m) => m.email.includes(q) || m.galleries.some((g) => g.toLowerCase().includes(q))) : audience;
  }, [audience, query]);
  const recipients = reachable.filter((m) => selected.has(m.email)).map((m) => m.email);

  function toggle(email: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  async function post(payload: Record<string, unknown>) {
    const res = await fetch("/api/admin/mail", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject, body, ...payload }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
    return json as { campaignId: string | null; sent: string[]; failed: { email: string; error: string }[] };
  }

  async function sendTest() {
    setBusy("test");
    setNotice(null);
    try {
      const r = await post({ test: true });
      setNotice(r.sent.length ? { ok: "Test envoyé dans votre boîte mail. Vérifiez le rendu avant d'envoyer à tout le monde." } : { error: r.failed[0]?.error ?? "Échec de l'envoi" });
    } catch (e) {
      setNotice({ error: e instanceof Error ? e.message : "Échec de l'envoi" });
    }
    setBusy(null);
  }

  async function sendAll() {
    if (!confirm(`Envoyer « ${subject} » à ${recipients.length} personne${recipients.length > 1 ? "s" : ""} ?`)) return;
    setBusy("send");
    setNotice(null);
    const failed: string[] = [];
    let campaignId: string | null = null;
    setProgress({ done: 0, total: recipients.length, failed });
    try {
      for (let i = 0; i < recipients.length; i += BATCH) {
        const r = await post({ emails: recipients.slice(i, i + BATCH), total: recipients.length, campaignId });
        campaignId = r.campaignId;
        failed.push(...r.failed.map((f) => f.email));
        setProgress({ done: Math.min(i + BATCH, recipients.length), total: recipients.length, failed: [...failed] });
      }
      setNotice(failed.length ? { error: `Envoyé, sauf à : ${failed.join(", ")}` } : { ok: `Message envoyé à ${recipients.length} personne${recipients.length > 1 ? "s" : ""}.` });
    } catch (e) {
      setNotice({ error: `Envoi interrompu : ${e instanceof Error ? e.message : "erreur"}` });
    }
    setBusy(null);
    router.refresh();
  }

  async function copyAll() {
    await navigator.clipboard.writeText(recipients.join(", "));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (audience.length === 0) {
    return <p className="mt-16 py-16 text-center text-sm text-muted border-t border-line">Aucune adresse pour l&apos;instant. Elles apparaîtront dès qu&apos;un client enregistrera une sélection ou téléchargera des photos.</p>;
  }

  return (
    <div className="mt-12 space-y-16">
      <div className="grid grid-cols-3 gap-3">
        {[
          [audience.length, "adresse" + (audience.length > 1 ? "s" : "")],
          [recipients.length, "sélectionnée" + (recipients.length > 1 ? "s" : "")],
          [audience.length - reachable.length, "désinscrite" + (audience.length - reachable.length > 1 ? "s" : "")],
        ].map(([n, label]) => (
          <div key={label as string} className="border border-line px-4 py-5 text-center">
            <p className="display text-3xl">{n}</p>
            <p className="text-[11px] text-muted mt-1">{label}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="label mb-6">Écrire un message</h2>
        {!configured && (
          <p className="text-sm border border-line bg-bg-soft px-4 py-3 mb-8 leading-relaxed">
            L&apos;envoi n&apos;est pas encore branché sur votre Gmail. Ajoutez <code>SMTP_USER</code> et <code>SMTP_PASS</code> sur Netlify
            (voir le guide, « E-mails aux clients »), puis redéployez.
          </p>
        )}
        <div className="space-y-6">
          <div>
            <label className="label" htmlFor="subject">Objet</label>
            <input id="subject" className="field" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
          </div>
          <div>
            <label className="label" htmlFor="body">Message</label>
            <textarea id="body" className="field leading-relaxed" rows={12} style={{ minHeight: "18rem", resize: "vertical" }} value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} />
            <p className="text-xs text-muted mt-2">Votre carte de visite (WhatsApp, Instagram, TikTok…) et un lien de désinscription sont ajoutés automatiquement en bas.</p>
          </div>
          {progress && busy === "send" && (
            <div>
              <div className="h-1 bg-line">
                <div className="h-full bg-ink transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
              <p className="text-xs text-muted mt-2">{progress.done} / {progress.total} envoyés… Gardez cette page ouverte.</p>
            </div>
          )}
          {notice?.ok && <p className="text-sm text-accent">{notice.ok}</p>}
          {notice?.error && <p className="text-sm text-danger">{notice.error}</p>}
          <div className="flex flex-wrap gap-3">
            <button className="btn" onClick={sendAll} disabled={!configured || busy !== null || recipients.length === 0 || !subject.trim() || !body.trim()}>
              {busy === "send" ? "Envoi…" : `Envoyer à ${recipients.length}`}
            </button>
            <button className="btn btn-ghost" onClick={sendTest} disabled={!configured || busy !== null || !subject.trim() || !body.trim()}>
              {busy === "test" ? "Envoi…" : "M'envoyer un test"}
            </button>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="label">Destinataires</h2>
          <div className="flex gap-4 text-xs">
            <button className="text-muted hover:text-ink" onClick={() => setSelected(new Set(reachable.map((m) => m.email)))}>Tout</button>
            <button className="text-muted hover:text-ink" onClick={() => setSelected(new Set())}>Aucun</button>
            <button className="text-muted hover:text-ink" onClick={copyAll} disabled={recipients.length === 0}>{copied ? "Copié ✓" : "Copier"}</button>
          </div>
        </div>
        {audience.length > 8 && (
          <input className="field mb-2" placeholder="Rechercher une adresse ou une galerie" value={query} onChange={(e) => setQuery(e.target.value)} />
        )}
        <ul>
          {shown.map((m) => (
            <li key={m.email}>
              <label className={`flex items-center gap-4 py-4 border-b border-line ${m.unsubscribed ? "opacity-50" : "cursor-pointer"}`}>
                <input type="checkbox" className="w-4 h-4 accent-current" checked={!m.unsubscribed && selected.has(m.email)} disabled={m.unsubscribed} onChange={() => toggle(m.email)} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] truncate">{m.email}</span>
                  <span className="block text-xs text-muted truncate mt-0.5">
                    {m.unsubscribed ? "Désinscrit · " : ""}
                    {m.galleries.join(", ") || "Galerie supprimée"}
                  </span>
                </span>
                <span className="text-right text-xs text-muted shrink-0">
                  <span className="block">{dateFmt.format(new Date(m.lastSeen))}</span>
                  <span className="block mt-0.5">{[m.favorites && "♡", m.downloads > 0 && `↓ ${m.downloads}`].filter(Boolean).join("  ")}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {campaigns.length > 0 && (
        <section>
          <h2 className="label mb-4">Messages envoyés</h2>
          <ul>
            {campaigns.map((c) => (
              <li key={c.id} className="flex items-center gap-4 py-4 border-b border-line">
                <span className="flex-1 min-w-0 text-[15px] truncate">{c.subject}</span>
                <span className="text-xs text-muted shrink-0">
                  {c.sent} envoyé{c.sent > 1 ? "s" : ""}{c.failed ? ` · ${c.failed} échec${c.failed > 1 ? "s" : ""}` : ""} · {dateFmt.format(new Date(c.created_at))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
