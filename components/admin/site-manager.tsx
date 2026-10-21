"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  addSiteClip,
  commitSitePhoto,
  deleteSiteClip,
  deleteSitePhoto,
  prepareSitePhoto,
  reorderSiteClips,
  saveSiteKit,
  setSitePhotoCategory,
  swapSitePhotos,
  updateSiteClip,
} from "@/app/admin/site-actions";
import { makeSiteImage } from "@/lib/client/image";
import { ChevronDown, ChevronLeft, ChevronRight, PlusIcon, TrashIcon, UploadIcon } from "@/components/icons";

type Clip = { id: string; youtubeId: string; artist: string; title: string; kind: "clip" | "visualizer"; start: number };
type Photo = { id: string; slug: string; thumb: string };
type KitItem = { type: string; model: string };

/** Types de matériel proposés (traduits sur le site) ; « Autre » = texte libre. Mêmes clés que lib/site.ts (KIT_TYPES). */
const KIT_TYPES: { key: string; label: string }[] = [
  { key: "kit_a7", label: "Caméra plein format" },
  { key: "kit_a67", label: "Caméra APS-C" },
  { key: "kit_drone", label: "Drone" },
  { key: "kit_lens", label: "Objectif" },
  { key: "kit_mic", label: "Micro" },
  { key: "kit_gimbal", label: "Stabilisateur" },
  { key: "kit_light", label: "Lumière" },
];

/** Catégories de photos du site, dans l'ordre de ses filtres (mêmes clés que la page). */
const CATS: { slug: string; label: string }[] = [
  { slug: "sport", label: "Sport" },
  { slug: "portrait", label: "Portrait" },
  { slug: "evenement", label: "Événements" },
  { slug: "bapteme", label: "Baptême" },
  { slug: "mariage", label: "Mariage" },
];

/** Prépare la photo (2400 px + vignette), l'envoie directement chez Oracle, puis l'enregistre. */
async function uploadPhoto(file: File, slug: string) {
  const img = await makeSiteImage(file);
  const res = await prepareSitePhoto(img.blob.size, img.thumb.size);
  if (!res.ok) throw new Error(res.error);
  const put = (url: string, body: Blob) =>
    fetch(url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body }).then((r) => {
      if (!r.ok) throw new Error(`Envoi refusé (${r.status})`);
    });
  await Promise.all([put(res.url, img.blob), put(res.thumbUrl, img.thumb)]);
  const done = await commitSitePhoto(slug, { id: res.id, width: img.width, height: img.height });
  if (!done.ok) throw new Error(done.error);
}

/** Studio → Site : le contenu du site alvzrec.com (le design de la page ne change pas). */
export function SiteManager({
  clips,
  photos,
  groups,
  kit,
  whatsapp,
}: {
  clips: Clip[];
  photos: Photo[];
  groups: { coulisses: Photo[]; materiel: Photo[] };
  kit: KitItem[];
  whatsapp: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl">Site</h1>
          <p className="text-sm text-muted mt-3 max-w-xl leading-relaxed">
            Votre site alvzrec : le design reste le même, vous gérez ici les clips et les photos. Un changement apparaît sur le
            site en quelques minutes.
          </p>
        </div>
        <button className="btn btn-ghost shrink-0" onClick={() => window.open(`/site?v=${Date.now()}`, "_blank", "noopener")}>
          Voir le site ↗
        </button>
      </div>

      <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
        <a href="#clips" className="hover:text-ink">Clips</a>
        <a href="#photos" className="hover:text-ink">Photos</a>
        <a href="#coulisses" className="hover:text-ink">Coulisses et matériel</a>
        <a href="#whatsapp" className="hover:text-ink">WhatsApp</a>
        <a href="#relier" className="hover:text-ink">Relier alvzrec.com</a>
      </nav>

      <ClipsSection clips={clips} onChange={refresh} />
      <PhotosSection photos={photos} onChange={refresh} />
      <Section id="coulisses" title="Coulisses et matériel" hint="Les 3 premières photos des coulisses s'affichent en grand, les suivantes dans une bande qu'on fait défiler. Pour le matériel : la première photo est à côté de la liste, les autres dessous.">
        <div className="space-y-12">
          <GroupPhotos slug="coulisses" label="Coulisses" photos={groups.coulisses} big={3} onChange={refresh} />
          <GroupPhotos slug="materiel" label="Matériel : photos" photos={groups.materiel} big={1} onChange={refresh} />
          <KitEditor kit={kit} />
        </div>
      </Section>

      <Section id="whatsapp" title="WhatsApp, Instagram, TikTok">
        <p className="text-sm text-muted max-w-xl leading-relaxed">
          Les boutons « Demander un devis » et « Écrire sur WhatsApp » du site ouvrent WhatsApp sur le numéro de vos{" "}
          <Link href="/admin/settings" className="underline underline-offset-2 hover:text-ink">Coordonnées</Link>
          {whatsapp ? <> (actuellement <span className="text-ink">{whatsapp}</span>)</> : " (aucun numéro : celui de l'ancien site est gardé)"}.
        </p>
      </Section>

      <Section id="relier" title="Relier alvzrec.com (une seule fois)" hint="Pour que ces changements arrivent sur alvzrec.com, la page posée sur votre ancien compte Netlify doit être remplacée une fois par celle-ci, qui lit son contenu ici.">
        <ol className="text-sm leading-relaxed space-y-2 list-decimal pl-5 max-w-xl">
          <li>
            <a href="/api/admin/site/page" className="underline underline-offset-2">Téléchargez le fichier index.html</a>.
          </li>
          <li>Sur votre ordinateur, créez un dossier (par exemple « alvzrec ») et mettez-y ce fichier.</li>
          <li>Connectez-vous à l&apos;ancien compte Netlify, ouvrez le projet du site, onglet « Deploys ».</li>
          <li>Glissez le dossier dans la zone en bas de la page (« Drag and drop your project output folder here »).</li>
        </ol>
        <p className="text-xs text-muted mt-3 max-w-xl">À refaire seulement si on change le design ou les textes de la page, pas pour les clips ou les photos.</p>
      </Section>
    </div>
  );
}

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-14 scroll-mt-24 border-t border-line pt-8">
      <h2 className="eyebrow text-muted">{title}</h2>
      {hint && <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">{hint}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function ClipsSection({ clips, onChange }: { clips: Clip[]; onChange: () => void }) {
  const [list, setList] = useState(clips);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  useEffect(() => setList(clips), [clips]);

  async function move(i: number, by: number) {
    const next = [...list];
    const [c] = next.splice(i, 1);
    next.splice(i + by, 0, c);
    setList(next);
    const res = await reorderSiteClips(next.map((x) => x.id));
    if (!res.ok) setError(res.error);
  }

  return (
    <Section id="clips" title={`Clips · ${list.length}`} hint="Les vidéos YouTube de la partie « Vidéo ». Collez simplement le lien : le titre et l'artiste sont repris de YouTube (modifiables ensuite). Un extrait tourne en boucle sur chaque carte, à partir de la seconde indiquée.">
      <form
        className="border border-line p-4 sm:p-5 grid sm:grid-cols-2 gap-x-6 gap-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          setError("");
          setAdding(true);
          const res = await addSiteClip({
            link: String(f.get("link") ?? ""),
            artist: String(f.get("artist") ?? ""),
            title: String(f.get("title") ?? ""),
            kind: String(f.get("kind") ?? "auto"),
            start: Number(f.get("start") ?? 40),
          });
          setAdding(false);
          if (!res.ok) return setError(res.error);
          form.reset();
          onChange();
        }}
      >
        <div className="sm:col-span-2">
          <label className="label" htmlFor="clip-link">Lien YouTube du nouveau clip</label>
          <input id="clip-link" name="link" required placeholder="https://youtu.be/…" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="clip-artist">Artiste</label>
          <input id="clip-artist" name="artist" placeholder="Automatique (depuis YouTube)" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="clip-title">Titre</label>
          <input id="clip-title" name="title" placeholder="Automatique (depuis YouTube)" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="clip-kind">Type</label>
          <select id="clip-kind" name="kind" defaultValue="auto" className="field">
            <option value="auto">Automatique</option>
            <option value="clip">Clip officiel</option>
            <option value="visualizer">Visualizer</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="clip-start">Début de l&apos;extrait (secondes)</label>
          <input id="clip-start" name="start" type="number" min={0} defaultValue={40} className="field" />
        </div>
        <div className="sm:col-span-2 flex items-center gap-4">
          <button className="btn" disabled={adding}>
            <PlusIcon className="w-4 h-4" /> {adding ? "Ajout…" : "Ajouter en haut de la liste"}
          </button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </form>

      <ul className="mt-6 divide-y divide-line border-y border-line">
        {list.map((c, i) => (
          <ClipRow key={c.id} clip={c} first={i === 0} last={i === list.length - 1} onMove={(by) => move(i, by)} onChange={onChange} onError={setError} />
        ))}
      </ul>
    </Section>
  );
}

function ClipRow({ clip, first, last, onMove, onChange, onError }: { clip: Clip; first: boolean; last: boolean; onMove: (by: number) => void; onChange: () => void; onError: (e: string) => void }) {
  const [saved, setSaved] = useState(false);
  async function save(patch: Parameters<typeof updateSiteClip>[1]) {
    const res = await updateSiteClip(clip.id, patch);
    if (!res.ok) return onError(res.error);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }
  return (
    <li className="py-4 grid grid-cols-[96px_1fr] sm:grid-cols-[140px_1fr_auto] gap-x-4 gap-y-3 items-center">
      <a href={`https://youtu.be/${clip.youtubeId}`} target="_blank" rel="noopener" className="block aspect-video bg-bg-soft overflow-hidden row-span-2 sm:row-span-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://img.youtube.com/vi/${clip.youtubeId}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />
      </a>
      <div className="grid sm:grid-cols-[1fr_1fr] gap-x-4 gap-y-1 min-w-0">
        <input defaultValue={clip.title} onBlur={(e) => e.target.value !== clip.title && save({ title: e.target.value })} className="bg-transparent outline-none text-[15px] min-w-0 border-b border-transparent focus:border-line" aria-label="Titre" />
        <input defaultValue={clip.artist} onBlur={(e) => e.target.value !== clip.artist && save({ artist: e.target.value })} className="bg-transparent outline-none text-sm text-muted min-w-0 border-b border-transparent focus:border-line" aria-label="Artiste" placeholder="Artiste" />
        <span className="flex items-center gap-3 text-xs text-muted sm:col-span-2">
          <select defaultValue={clip.kind} onChange={(e) => save({ kind: e.target.value })} className="bg-transparent outline-none" aria-label="Type">
            <option value="clip">Clip officiel</option>
            <option value="visualizer">Visualizer</option>
          </select>
          <label className="flex items-center gap-1">
            extrait à
            <input type="number" min={0} defaultValue={clip.start} onBlur={(e) => Number(e.target.value) !== clip.start && save({ start: Number(e.target.value) })} className="w-14 bg-transparent outline-none border-b border-line text-ink text-center" />
            s
          </label>
          {saved && <span>Enregistré ✓</span>}
        </span>
      </div>
      <div className="flex items-center gap-1 col-start-2 sm:col-start-auto">
        <button className="icon-btn" disabled={first} onClick={() => onMove(-1)} aria-label="Monter" title="Monter">
          <ChevronDown className="w-4 h-4 rotate-180" />
        </button>
        <button className="icon-btn" disabled={last} onClick={() => onMove(1)} aria-label="Descendre" title="Descendre">
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          className="icon-btn text-muted hover:text-danger"
          aria-label="Retirer du site"
          title="Retirer du site"
          onClick={async () => {
            if (!confirm(`Retirer « ${clip.title} » du site ?`)) return;
            const res = await deleteSiteClip(clip.id);
            if (!res.ok) return onError(res.error);
            onChange();
          }}
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
}

function PhotosSection({ photos, onChange }: { photos: Photo[]; onChange: () => void }) {
  const [list, setList] = useState(photos);
  const [filter, setFilter] = useState("all");
  const [target, setTarget] = useState("sport");
  const [queue, setQueue] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setList(photos), [photos]);
  useEffect(() => {
    if (filter !== "all") setTarget(filter);
  }, [filter]);

  const shown = filter === "all" ? list : list.filter((p) => p.slug === filter);

  async function upload(files: File[]) {
    setErrors([]);
    const failed: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setQueue({ done: i, total: files.length });
      try {
        await uploadPhoto(files[i], target);
      } catch (e) {
        failed.push(`${files[i].name} : ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setQueue(null);
    setErrors(failed);
    onChange();
  }

  async function move(i: number, by: number) {
    const a = shown[i];
    const b = shown[i + by];
    if (!a || !b) return;
    setList((l) => {
      const next = [...l];
      const ia = next.findIndex((x) => x.id === a.id);
      const ib = next.findIndex((x) => x.id === b.id);
      [next[ia], next[ib]] = [next[ib], next[ia]];
      return next;
    });
    const res = await swapSitePhotos(a.id, b.id);
    if (!res.ok) setErrors([res.error]);
  }

  return (
    <Section id="photos" title={`Photos · ${list.length}`} hint="La partie « Photo » du site, avec ses filtres. L'ordre ici est celui du site ; les flèches déplacent une photo.">
      <div className="flex flex-wrap gap-2">
        {[{ slug: "all", label: "Tout" }, ...CATS].map((c) => {
          const count = c.slug === "all" ? list.length : list.filter((p) => p.slug === c.slug).length;
          return (
            <button
              key={c.slug}
              onClick={() => setFilter(c.slug)}
              className={`h-9 px-4 rounded-full border text-[13px] ${filter === c.slug ? "bg-ink text-bg border-ink" : "border-line text-muted hover:text-ink"}`}
            >
              {c.label} <span className="opacity-60 ml-1">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button className="btn" disabled={Boolean(queue)} onClick={() => fileRef.current?.click()}>
          <UploadIcon className="w-4 h-4" /> {queue ? `Envoi ${queue.done + 1} / ${queue.total}…` : "Ajouter des photos"}
        </button>
        <label className="text-sm text-muted flex items-center gap-2">
          dans
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="bg-transparent border-b border-line text-ink outline-none py-1">
            {CATS.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
          </select>
        </label>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*"
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length) upload(files);
          }}
        />
      </div>
      {errors.length > 0 && (
        <ul className="mt-3 text-sm text-danger space-y-1">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="mt-5 grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
        {shown.map((p, i) => (
          <div key={p.id} className="relative group">
            <div className="aspect-square bg-bg-soft overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
            </div>
            <div className="absolute inset-x-0 top-0 flex justify-between p-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <span className="flex gap-1">
                <button disabled={i === 0} onClick={() => move(i, -1)} aria-label="Avancer" className="w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button disabled={i === shown.length - 1} onClick={() => move(i, 1)} aria-label="Reculer" className="w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </span>
              <button
                aria-label="Retirer du site"
                className="w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-danger"
                onClick={async () => {
                  if (!confirm("Retirer cette photo du site ?")) return;
                  setList((l) => l.filter((x) => x.id !== p.id));
                  const res = await deleteSitePhoto(p.id);
                  if (!res.ok) setErrors([res.error]);
                  onChange();
                }}
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            <select
              value={p.slug}
              onChange={async (e) => {
                const slug = e.target.value;
                setList((l) => l.map((x) => (x.id === p.id ? { ...x, slug } : x)));
                const res = await setSitePhotoCategory(p.id, slug);
                if (!res.ok) setErrors([res.error]);
              }}
              className="mt-1 w-full bg-transparent text-xs text-muted outline-none"
              aria-label="Catégorie"
            >
              {CATS.map((c) => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </select>
          </div>
        ))}
        {!shown.length && <p className="col-span-full text-sm text-muted">Aucune photo dans cette catégorie.</p>}
      </div>
    </Section>
  );
}

/** Photos des coulisses ou du matériel : ajouter (plusieurs à la fois), déplacer, retirer. Les `big` premières sont en grand. */
function GroupPhotos({ slug, label, photos, big, onChange }: { slug: string; label: string; photos: Photo[]; big: number; onChange: () => void }) {
  const [list, setList] = useState(photos);
  const [queue, setQueue] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setList(photos), [photos]);

  async function upload(files: File[]) {
    setErrors([]);
    const failed: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setQueue({ done: i, total: files.length });
      try {
        await uploadPhoto(files[i], slug);
      } catch (e) {
        failed.push(`${files[i].name} : ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setQueue(null);
    setErrors(failed);
    onChange();
  }

  async function move(i: number, by: number) {
    const a = list[i];
    const b = list[i + by];
    if (!a || !b) return;
    setList((l) => {
      const next = [...l];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });
    const res = await swapSitePhotos(a.id, b.id);
    if (!res.ok) setErrors([res.error]);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {label} <span className="text-muted">· {list.length}</span>
        </p>
        <button className="btn btn-ghost" disabled={Boolean(queue)} onClick={() => fileRef.current?.click()}>
          <UploadIcon className="w-4 h-4" /> {queue ? `Envoi ${queue.done + 1} / ${queue.total}…` : "Ajouter des photos"}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*"
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length) upload(files);
          }}
        />
      </div>
      {errors.length > 0 && (
        <ul className="mt-3 text-sm text-danger space-y-1">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
        {list.map((p, i) => (
          <div key={p.id} className="relative group">
            <div className={`aspect-[4/5] bg-bg-soft overflow-hidden ${i < big ? "ring-1 ring-ink/40" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
            </div>
            <div className="absolute inset-x-0 top-0 flex justify-between p-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <span className="flex gap-1">
                <button disabled={i === 0} onClick={() => move(i, -1)} aria-label="Avancer" className="w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Reculer" className="w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </span>
              <button
                aria-label="Retirer du site"
                className="w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-danger"
                onClick={async () => {
                  if (!confirm("Retirer cette photo du site ?")) return;
                  setList((l) => l.filter((x) => x.id !== p.id));
                  const res = await deleteSitePhoto(p.id);
                  if (!res.ok) setErrors([res.error]);
                  onChange();
                }}
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted">{i < big ? (big === 1 ? "Principale" : "En grand") : "Bande"}</p>
          </div>
        ))}
        {!list.length && <p className="col-span-full text-sm text-muted">Aucune photo : le site garde ses photos d&apos;origine.</p>}
      </div>
    </div>
  );
}

/** Liste du matériel (type + modèle) affichée sur le site, enregistrée d'un coup. */
function KitEditor({ kit }: { kit: KitItem[] }) {
  const [list, setList] = useState<KitItem[]>(kit);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  useEffect(() => setList(kit), [kit]);
  const edit = (i: number, patch: Partial<KitItem>) => {
    setState("idle");
    setList((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };
  const move = (i: number, by: number) => {
    setState("idle");
    setList((l) => {
      const next = [...l];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });
  };

  return (
    <div>
      <p className="text-sm">Matériel : la liste</p>
      <p className="text-xs text-muted mt-1">Le type est traduit automatiquement sur le site (anglais, portugais) ; avec « Autre », il s&apos;affiche tel que vous l&apos;écrivez.</p>
      <ul className="mt-4 space-y-2 max-w-2xl">
        {list.map((it, i) => {
          const known = KIT_TYPES.some((t) => t.key === it.type);
          return (
            <li key={i} className="flex flex-wrap sm:flex-nowrap items-center gap-2 pb-3 border-b border-line sm:pb-0 sm:border-0">
              {/* `.field` impose sa largeur : la taille se règle sur l'enveloppe. */}
              <span className="w-full sm:w-48 shrink-0">
                <select
                  value={known ? it.type : "other"}
                  onChange={(e) => edit(i, { type: e.target.value === "other" ? "" : e.target.value })}
                  className="field"
                  style={{ width: "100%" }}
                  aria-label="Type"
                >
                  {KIT_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                  <option value="other">Autre…</option>
                </select>
              </span>
              {!known && (
                <span className="w-full sm:w-44 shrink-0">
                  <input value={it.type} onChange={(e) => edit(i, { type: e.target.value })} placeholder="Type (ex. Lumière LED)" className="field" style={{ width: "100%" }} maxLength={60} />
                </span>
              )}
              <span className="flex-1 min-w-0 w-full sm:w-auto">
                <input value={it.model} onChange={(e) => edit(i, { model: e.target.value })} placeholder="Modèle (ex. Sony a7 IV)" className="field" style={{ width: "100%" }} maxLength={60} />
              </span>
              <span className="flex gap-1 shrink-0">
                <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter">
                  <ChevronDown className="w-4 h-4 rotate-180" />
                </button>
                <button className="icon-btn" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Descendre">
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  className="icon-btn hover:text-danger"
                  onClick={() => {
                    setState("idle");
                    setList((l) => l.filter((_, j) => j !== i));
                  }}
                  aria-label="Retirer"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          className="btn btn-ghost"
          disabled={list.length >= 12}
          onClick={() => {
            setState("idle");
            setList((l) => [...l, { type: "kit_lens", model: "" }]);
          }}
        >
          <PlusIcon className="w-4 h-4" /> Ajouter du matériel
        </button>
        <button
          className="btn"
          disabled={state === "saving"}
          onClick={async () => {
            setState("saving");
            setError("");
            const res = await saveSiteKit(list);
            if (res.ok) setState("saved");
            else {
              setError(res.error);
              setState("idle");
            }
          }}
        >
          {state === "saving" ? "Enregistrement…" : state === "saved" ? "Enregistré ✓" : "Enregistrer la liste"}
        </button>
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    </div>
  );
}
