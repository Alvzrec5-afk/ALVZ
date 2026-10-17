"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { regenerateLink, setGalleryExpiry, setGalleryPassword } from "@/app/admin/actions";
import { DownloadIcon, HeartIcon, LockIcon, WrenchIcon } from "@/components/icons";
import type { ManagedGallery } from "./gallery-manager";
import { ListRow, SubHeader, Toggle } from "./ui";
import { SaveStatus, useSave } from "./use-save";

type View = "menu" | "general" | "privacy" | "download" | "favorites";

export function SettingsPanel({ gallery, onDelete }: { gallery: ManagedGallery; onDelete: () => void }) {
  const router = useRouter();
  const [view, setView] = useState<View>("menu");
  const { save, status } = useSave(gallery.id);
  const [opts, setOpts] = useState({
    watermark: gallery.watermark,
    downloads_enabled: gallery.downloadsEnabled,
    download_web_enabled: gallery.downloadWebEnabled,
    favorites_enabled: gallery.favoritesEnabled,
  });
  useEffect(
    () =>
      setOpts({
        watermark: gallery.watermark,
        downloads_enabled: gallery.downloadsEnabled,
        download_web_enabled: gallery.downloadWebEnabled,
        favorites_enabled: gallery.favoritesEnabled,
      }),
    [gallery.watermark, gallery.downloadsEnabled, gallery.downloadWebEnabled, gallery.favoritesEnabled],
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
        <Toggle checked={opts.downloads_enabled} onChange={toggle("downloads_enabled")} label="Autoriser le téléchargement" hint="Photo par photo dans la visionneuse, ou toute la galerie / une collection en ZIP." />
        <div className={opts.downloads_enabled ? "" : "opacity-40 pointer-events-none"}>
          <Toggle
            checked={opts.download_web_enabled}
            onChange={toggle("download_web_enabled")}
            label="Proposer aussi la taille web"
            hint="En plus de la haute définition, le client peut télécharger une version légère (2000 px), idéale pour les réseaux sociaux."
          />
        </div>
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
        <h3 className="label">Lien secret</h3>
        <p className="text-sm text-muted">Générer un nouveau lien rend l&apos;ancien inutilisable (utile si le lien a circulé par erreur).</p>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            if (!confirm("Générer un nouveau lien ? L'ancien ne fonctionnera plus.")) return;
            await regenerateLink(gallery.id);
            router.refresh();
          }}
        >
          Nouveau lien
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
      {msg && <p className="text-xs text-emerald-400 mt-3">{msg}</p>}
    </div>
  );
}
