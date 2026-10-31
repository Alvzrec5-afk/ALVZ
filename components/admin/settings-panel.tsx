"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { regenerateLink, setGalleryExpiry, setGalleryPassword, setGallerySlug } from "@/app/admin/actions";
import { DownloadIcon, HeartIcon, LockIcon, PeopleIcon, WrenchIcon } from "@/components/icons";
import { faceIndexer } from "@/lib/client/face-indexer";
import type { ManagedGallery } from "./gallery-manager";
import { ListRow, SubHeader, Toggle } from "./ui";
import { SaveStatus, useSave } from "./use-save";

type View = "menu" | "general" | "privacy" | "download" | "favorites" | "contact" | "faces";

export function SettingsPanel({ gallery, onDelete }: { gallery: ManagedGallery; onDelete: () => void }) {
  const router = useRouter();
  const [view, setView] = useState<View>("menu");
  const { save, status } = useSave(gallery.id);
  const [opts, setOpts] = useState({
    watermark: gallery.watermark,
    downloads_enabled: gallery.downloadsEnabled,
    download_web_enabled: gallery.downloadWebEnabled,
    download_email_required: gallery.downloadEmailRequired,
    zip_enabled: gallery.zipEnabled,
    face_search_enabled: gallery.faceSearchEnabled,
    favorites_enabled: gallery.favoritesEnabled,
    show_contact: gallery.design.show_contact,
  });
  useEffect(
    () =>
      setOpts({
        watermark: gallery.watermark,
        downloads_enabled: gallery.downloadsEnabled,
        download_web_enabled: gallery.downloadWebEnabled,
        download_email_required: gallery.downloadEmailRequired,
        zip_enabled: gallery.zipEnabled,
        face_search_enabled: gallery.faceSearchEnabled,
        favorites_enabled: gallery.favoritesEnabled,
        show_contact: gallery.design.show_contact,
      }),
    [gallery.watermark, gallery.downloadsEnabled, gallery.downloadWebEnabled, gallery.downloadEmailRequired, gallery.zipEnabled, gallery.faceSearchEnabled, gallery.favoritesEnabled, gallery.design.show_contact],
  );
  const toggle = (key: keyof typeof opts) => (v: boolean) => {
    setOpts((o) => ({ ...o, [key]: v }));
    save({ [key]: v });
  };

  if (view === "menu") {
    return (
      <div>
        <p className="eyebrow text-muted mb-2">Paramètres</p>
        <ListRow icon={<WrenchIcon />} label="Général" value={gallery.expiresAt ? `Expire le ${gallery.expiresAt.split("-").reverse().join("/")}` : undefined} onClick={() => setView("general")} />
        <ListRow icon={<LockIcon />} label="Confidentialité" value={gallery.hasPassword ? "Mot de passe" : "Lien seul"} onClick={() => setView("privacy")} />
        <ListRow icon={<DownloadIcon />} label="Téléchargement" badge={opts.downloads_enabled} onClick={() => setView("download")} />
        <ListRow icon={<HeartIcon />} label="Favoris" badge={opts.favorites_enabled} onClick={() => setView("favorites")} />
        {gallery.kind === "photo" && (
          <ListRow icon={<PeopleIcon />} label="Recherche par visage" badge={opts.face_search_enabled} onClick={() => setView("faces")} />
        )}
        <ListRow icon={<CardIcon />} label="Carte de visite" badge={opts.show_contact} onClick={() => setView("contact")} />
      </div>
    );
  }

  const back = () => setView("menu");

  if (view === "general") return <GeneralSettings gallery={gallery} onBack={back} onDelete={onDelete} save={save} status={status} router={router} />;

  if (view === "privacy") {
    return (
      <div>
        <SubHeader title="Confidentialité" onBack={back} />
        <PasswordSetting gallery={gallery} onDone={() => router.refresh()} />
        <div className="mt-8">
          <Toggle
            checked={opts.watermark}
            onChange={toggle("watermark")}
            label="Filigrane ALVZ.REC"
            hint="Les aperçus affichés au client portent le filigrane. Les fichiers HD téléchargés restent intacts."
          />
        </div>
        <div className="mt-6"><SaveStatus status={status} /></div>
      </div>
    );
  }

  if (view === "download") {
    return (
      <div>
        <SubHeader title="Téléchargement" onBack={back} />
        <Toggle checked={opts.downloads_enabled} onChange={toggle("downloads_enabled")} label="Autoriser le téléchargement" hint="Photo par photo dans la visionneuse (et toute la galerie en ZIP, si l'option ci-dessous est activée)." />
        <div className={opts.downloads_enabled ? "" : "opacity-40 pointer-events-none"}>
          <Toggle
            checked={opts.zip_enabled}
            onChange={toggle("zip_enabled")}
            label="Autoriser le téléchargement de toute la galerie"
            hint="Désactivé : le client ne peut plus tout télécharger d'un coup (ZIP de la galerie ou d'une collection), seulement photo par photo depuis la visionneuse."
          />
          <Toggle
            checked={opts.download_web_enabled}
            onChange={toggle("download_web_enabled")}
            label="Proposer aussi la taille web"
            hint="En plus de la haute définition, le client peut télécharger une version légère (2000 px), idéale pour les réseaux sociaux."
          />
          <Toggle
            checked={opts.download_email_required}
            onChange={toggle("download_email_required")}
            label="Demander l'e-mail avant le téléchargement"
            hint="Le client indique son e-mail une seule fois avant de télécharger. Les adresses arrivent dans Outils → Clients & e-mails."
          />
        </div>
        <div className="mt-6"><SaveStatus status={status} /></div>
      </div>
    );
  }

  if (view === "faces") {
    return (
      <div>
        <SubHeader title="Recherche par visage" onBack={back} />
        <Toggle
          checked={opts.face_search_enabled}
          onChange={(v) => {
            toggle("face_search_enabled")(v);
            faceIndexer.setEnabled(gallery.id, v);
          }}
          label="Le client retrouve ses photos avec un selfie"
          hint="Bouton « Trouver mes photos » dans la galerie : le client prend un selfie et voit toutes les photos où il apparaît. Le selfie reste sur son téléphone (seule une empreinte du visage sert à la recherche, rien n'est enregistré). Le client doit accepter avant."
        />
        {opts.face_search_enabled && <FaceIndexStatus galleryId={gallery.id} />}
        <p className="text-xs text-muted mt-6 leading-relaxed max-w-xl">
          Données biométriques (RGPD) : n&apos;activez cette option que si vos clients en sont informés (contrat, mentions
          légales). Les empreintes des visages sont effacées avec les photos et la galerie.
        </p>
        <div className="mt-6"><SaveStatus status={status} /></div>
      </div>
    );
  }

  if (view === "contact") {
    return (
      <div>
        <SubHeader title="Carte de visite" onBack={back} />
        <Toggle
          checked={opts.show_contact}
          onChange={toggle("show_contact")}
          label="Afficher mes coordonnées en bas de la galerie"
          hint="WhatsApp, Instagram, TikTok, e-mail… Les coordonnées se modifient une seule fois pour toutes les galeries."
        />
        <a href="/admin/settings" className="btn btn-ghost mt-8">Modifier mes coordonnées</a>
        <div className="mt-6"><SaveStatus status={status} /></div>
      </div>
    );
  }

  return (
    <div>
      <SubHeader title="Favoris" onBack={back} />
      <Toggle
        checked={opts.favorites_enabled}
        onChange={toggle("favorites_enabled")}
        label="Activer les favoris"
        hint="Le client peut mettre des cœurs sur ses photos préférées après avoir indiqué son e-mail. Vous retrouvez sa sélection dans l'onglet Activité."
      />
      <div className="mt-6"><SaveStatus status={status} /></div>
    </div>
  );
}

function GeneralSettings({
  gallery,
  onBack,
  onDelete,
  save,
  status,
  router,
}: {
  gallery: ManagedGallery;
  onBack: () => void;
  onDelete: () => void;
  save: (patch: Record<string, unknown>) => Promise<boolean>;
  status: ReturnType<typeof useSave>["status"];
  router: ReturnType<typeof useRouter>;
}) {
  const [title, setTitle] = useState(gallery.title);
  const [date, setDate] = useState(gallery.eventDate);
  const [expires, setExpires] = useState(gallery.expiresAt);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return alert("Le nom du client est obligatoire.");
    setBusy(true);
    const ok = await save({ title, event_date: date || null });
    if (ok && expires !== gallery.expiresAt) {
      const r = await setGalleryExpiry(gallery.id, expires || null);
      if (r.error) alert(r.error);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div>
      <SubHeader title="Général" onBack={onBack} />
      <form onSubmit={submit} className="space-y-8 max-w-xl">
        <div>
          <label className="label" htmlFor="g-title">Nom du client</label>
          <input id="g-title" className="field display text-2xl" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="g-date">Date de l&apos;événement</label>
          <input id="g-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="g-exp">Date d&apos;expiration (optionnelle)</label>
          <input id="g-exp" type="date" className="field" value={expires} onChange={(e) => setExpires(e.target.value)} />
          {expires && (
            <button type="button" className="text-xs text-muted mt-2 hover:text-ink" onClick={() => setExpires("")}>Retirer l&apos;expiration</button>
          )}
          <p className="text-xs text-muted mt-2">Après cette date, le client voit une page « Galerie expirée ».</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="btn" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
          <SaveStatus status={status} />
        </div>
      </form>

      <section className="border-t border-line mt-14 pt-8 max-w-xl space-y-3">
        <h3 className="label">Lien de la galerie</h3>
        <SlugSetting gallery={gallery} onDone={() => router.refresh()} />
        <p className="text-sm text-muted pt-4">Ou générer un nouveau lien aléatoire, impossible à deviner. L&apos;ancien lien cessera de fonctionner.</p>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            if (!confirm("Générer un nouveau lien ? L'ancien ne fonctionnera plus.")) return;
            await regenerateLink(gallery.id);
            router.refresh();
          }}
        >
          Nouveau lien aléatoire
        </button>
      </section>
      <section className="border-t border-line mt-10 pt-8 max-w-xl space-y-3">
        <h3 className="label text-danger">Zone sensible</h3>
        <button className="btn btn-danger" onClick={onDelete}>Supprimer la galerie</button>
      </section>
    </div>
  );
}

function PasswordSetting({ gallery, onDone }: { gallery: ManagedGallery; onDone: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function apply(password: string | null) {
    setBusy(true);
    const r = await setGalleryPassword(gallery.id, password);
    setBusy(false);
    if (r.error) return alert(r.error);
    setValue("");
    setMsg(password ? "Mot de passe enregistré ✓" : "Mot de passe retiré ✓");
    onDone();
  }

  return (
    <div className="max-w-xl">
      <p className="text-[15px]">Mot de passe</p>
      <p className="text-xs text-muted mt-1 mb-4">
        {gallery.hasPassword
          ? "La galerie est protégée : le client doit saisir le mot de passe en plus du lien."
          : "Aucun mot de passe : toute personne ayant le lien peut voir la galerie."}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value) apply(value);
        }}
        className="flex gap-3 items-end"
      >
        <input className="field flex-1" type="text" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} placeholder={gallery.hasPassword ? "Nouveau mot de passe" : "Choisir un mot de passe"} />
        <button className="btn" disabled={busy || !value}>Définir</button>
      </form>
      {gallery.hasPassword && (
        <button className="text-xs text-muted mt-3 hover:text-danger" disabled={busy} onClick={() => apply(null)}>Retirer le mot de passe</button>
      )}
      {msg && <p className="text-xs text-accent mt-3">{msg}</p>}
    </div>
  );
}

function SlugSetting({ gallery, onDone }: { gallery: ManagedGallery; onDone: () => void }) {
  const [value, setValue] = useState(gallery.slug);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.host), []);
  useEffect(() => setValue(gallery.slug), [gallery.slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value === gallery.slug) return;
    if (!confirm("Changer le lien ? L'ancien lien ne fonctionnera plus pour vos clients.")) return;
    setBusy(true);
    const r = await setGallerySlug(gallery.id, value);
    setBusy(false);
    if (r.error) return setMsg({ ok: false, text: r.error });
    setValue(r.slug!);
    setMsg({ ok: true, text: "Lien enregistré ✓" });
    onDone();
  }

  return (
    <form onSubmit={submit}>
      <div className="flex items-end gap-1 border-b border-line focus-within:border-ink">
        <span className="text-sm text-muted pb-3 shrink-0">{origin}/g/</span>
        <input
          className="flex-1 min-w-0 bg-transparent outline-none py-3 text-base"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="camille-hugo"
        />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <button className="btn" disabled={busy || value === gallery.slug}>{busy ? "…" : "Enregistrer le lien"}</button>
        {msg && <span className={`text-xs ${msg.ok ? "text-accent" : "text-danger"}`}>{msg.text}</span>}
      </div>
      {!gallery.hasPassword && (
        <p className="text-xs text-warn mt-3">
          Conseil : un lien lisible est facile à deviner. Ajoutez un mot de passe (Confidentialité) pour une galerie privée.
        </p>
      )}
    </form>
  );
}

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 15.5c.6-1.3 1.7-2 3-2s2.4.7 3 2M14.5 10h4M14.5 13h3" />
    </svg>
  );
}

/** Avancement de l'analyse des visages d'une galerie, et bouton pour analyser les photos déjà en ligne. */
function FaceIndexStatus({ galleryId }: { galleryId: string }) {
  const live = useSyncExternalStore(faceIndexer.subscribe, faceIndexer.getSnapshot, faceIndexer.getServerSnapshot);
  const [count, setCount] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    fetch(`/api/admin/faces?gallery=${galleryId}&count=1`)
      .then((r) => r.json())
      .then((j) => !stop && setCount({ done: j.done ?? 0, total: j.total ?? 0 }))
      .catch(() => undefined);
    return () => {
      stop = true;
    };
    // Recompte à la fin de chaque analyse.
  }, [galleryId, live.running, live.done]);

  const remaining = count ? count.total - count.done : 0;
  return (
    <div className="mt-8 border border-line p-5 max-w-xl">
      <p className="text-sm">
        {count ? (
          <>
            <span className="display text-2xl mr-2">{count.done}</span>/ {count.total} photos analysées
          </>
        ) : (
          "…"
        )}
      </p>
      {live.running ? (
        <>
          <div className="h-1 bg-bg-soft mt-4 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${live.total ? (live.done / live.total) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-muted mt-3 leading-relaxed">
            Analyse en cours : {live.done} / {live.total}. Chaque photo est examinée en pleine définition, petits visages compris
            (quelques secondes par photo). Gardez cet onglet ouvert ; vous pouvez continuer à utiliser le studio.
          </p>
        </>
      ) : remaining > 0 ? (
        <>
          <button
            className="btn mt-4"
            onClick={() => {
              setError(null);
              faceIndexer.analyzeGallery(galleryId).catch((e) => setError(e instanceof Error ? e.message : String(e)));
            }}
          >
            Analyser {remaining} photo{remaining > 1 ? "s" : ""}
          </button>
          <p className="text-xs text-muted mt-3 leading-relaxed">
            Les nouvelles photos envoyées sont analysées automatiquement. Pour celles déjà en ligne, l&apos;analyse relit chaque
            original (quelques secondes par photo, à faire une fois).
          </p>
        </>
      ) : count && count.total > 0 ? (
        <p className="text-xs text-muted mt-3">Toutes les photos sont prêtes pour la recherche par selfie.</p>
      ) : null}
      {(error || live.error) && <p className="text-xs text-danger mt-3">{error || live.error}</p>}
    </div>
  );
}
