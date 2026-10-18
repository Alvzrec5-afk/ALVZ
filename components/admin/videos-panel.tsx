"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { deleteVideo, deleteVideoComment, setVideoCommentResolved, updateVideo } from "@/app/admin/actions";
import type { VideoComment, VideoView } from "@/lib/types";
import { VideoUploader } from "@/lib/client/video-uploader";
import { ArrowLeft, FilmIcon, PlusCircleIcon } from "@/components/icons";
import { VideoPlayer, formatTime, type PlayerHandle } from "@/components/video/video-player";
import { VideoComments } from "@/components/video/video-comments";
import { Toggle } from "./ui";

export type AdminVideo = VideoView & {
  sizeBytes: number;
  createdAt: string;
  comments: VideoComment[];
  views: number;
  avgWatched: number;
  downloadCount: number;
};

const size = (n: number) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2).replace(".", ",")} Go` : `${Math.max(1, Math.round(n / 1024 ** 2))} Mo`);

export function VideosPanel({ galleryId, slug, watermark, videos }: { galleryId: string; slug: string; watermark: boolean; videos: AdminVideo[] }) {
  const router = useRouter();
  const watermarkRef = useRef(watermark);
  watermarkRef.current = watermark;
  const [uploader] = useState(() => new VideoUploader(galleryId, () => watermarkRef.current, () => router.refresh()));
  const items = useSyncExternalStore(uploader.subscribe, uploader.getSnapshot, uploader.getSnapshot);
  const input = useRef<HTMLInputElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = videos.find((v) => v.id === openId);
  const busy = items.some((i) => i.status === "queued" || i.status === "working");

  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  if (open) return <VideoDetail key={open.id} galleryId={galleryId} slug={slug} video={open} onBack={() => setOpenId(null)} />;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 lg:mb-8">
        <h2 className="display text-2xl sm:text-3xl">Vidéos</h2>
        <button onClick={() => input.current?.click()} className="flex items-center gap-1.5 text-[13px] sm:text-sm text-accent hover:opacity-80">
          <PlusCircleIcon /> Ajouter des vidéos
        </button>
        <input
          ref={input}
          type="file"
          accept="video/*"
          multiple
          hidden
          onChange={(e) => {
            uploader.add([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="mb-10 border border-line">
          {items.map((i) => (
            <div key={i.id} className="px-4 py-3 border-b border-line last:border-0">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{i.file.name}</span>
                <span className={`shrink-0 text-xs ${i.status === "error" ? "text-danger" : "text-muted"}`}>
                  {i.step}
                  {i.status === "working" && ` · ${Math.round(i.progress * 100)} %`}
                </span>
              </div>
              {i.status === "working" && (
                <div className="mt-2 h-1 bg-line">
                  <div className="h-full bg-ink transition-[width] duration-500" style={{ width: `${i.progress * 100}%` }} />
                </div>
              )}
              {i.error && <p className="text-xs text-danger mt-1">{i.error}</p>}
            </div>
          ))}
          <div className="px-4 py-3 flex flex-wrap gap-4 text-xs text-muted bg-bg-soft">
            {busy ? (
              <span>Gardez cette page ouverte : votre ordinateur prépare les versions 1080p, 720p et 480p, puis les envoie.</span>
            ) : (
              <button className="hover:text-ink" onClick={() => uploader.clearFinished()}>Effacer la liste</button>
            )}
            {items.some((i) => i.status === "error") && (
              <button className="hover:text-ink" onClick={() => uploader.retryFailed()}>Réessayer les échecs</button>
            )}
          </div>
        </div>
      )}

      {videos.length === 0 ? (
        <button onClick={() => input.current?.click()} className="w-full py-16 text-center text-sm text-muted border border-dashed border-line hover:border-muted">
          <FilmIcon className="w-6 h-6 mx-auto mb-3" />
          Aucune vidéo dans cette galerie.
          <br />
          <span className="text-accent">Ajouter un clip</span>
          <span className="block text-xs mt-3 max-w-sm mx-auto leading-relaxed">
            Votre ordinateur prépare automatiquement plusieurs qualités : chaque client reçoit celle qui convient à sa connexion.
            {watermark && " Le filigrane de la galerie est incrusté dans la vidéo."}
          </span>
        </button>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-8">
          {videos.map((v) => (
            <li key={v.id}>
              <button onClick={() => setOpenId(v.id)} className="group block w-full text-left">
                <div className="relative aspect-video bg-bg-soft overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.poster} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                  <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[11px] tabular-nums px-1.5 py-0.5">{formatTime(v.duration)}</span>
                  {!v.downloadsEnabled && <span className="absolute top-2 left-2 bg-black/70 text-white text-[10px] uppercase tracking-wider px-1.5 py-0.5">Téléchargement bloqué</span>}
                </div>
                <p className="text-[15px] mt-3 truncate">{v.title}</p>
                <p className="text-xs text-muted mt-1">
                  {v.views} lecture{v.views > 1 ? "s" : ""} · {v.comments.length} commentaire{v.comments.length > 1 ? "s" : ""} · ↓ {v.downloadCount}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VideoDetail({ galleryId, slug, video, onBack }: { galleryId: string; slug: string; video: AdminVideo; onBack: () => void }) {
  const router = useRouter();
  const player = useRef<PlayerHandle>(null);
  const [title, setTitle] = useState(video.title);
  const [downloads, setDownloads] = useState(video.downloadsEnabled);
  const [comments, setComments] = useState(video.comments);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setComments(video.comments), [video.comments]);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/g/${slug}/v/${video.id}`;

  async function save(patch: { title?: string; downloads_enabled?: boolean }) {
    const r = await updateVideo(galleryId, video.id, patch);
    if (r.error) alert(r.error);
    router.refresh();
  }

  return (
    <div className={busy ? "opacity-40 pointer-events-none" : ""}>
      <button onClick={onBack} className="flex items-center gap-1 eyebrow text-muted hover:text-ink mb-6">
        <ArrowLeft className="w-4 h-4" /> Toutes les vidéos
      </button>
      <VideoPlayer
        ref={player}
        video={{ ...video, overlayWatermark: false }}
        comments={comments}
        onMarker={(c) => {
          player.current?.seek(c.time_sec);
          document.getElementById(`c-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
      />

      <div className="mt-8 grid lg:grid-cols-[1fr_340px] gap-x-12 gap-y-10">
        <div className="min-w-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== video.title && save({ title })}
            className="w-full bg-transparent outline-none display text-2xl sm:text-3xl border-b border-transparent focus:border-line pb-1"
            aria-label="Titre de la vidéo"
          />
          <p className="text-xs text-muted mt-2">
            {formatTime(video.duration)} · {video.sources.map((s) => `${s.h}p`).join(" / ")} · original {size(video.sizeBytes)}
            {video.watermarked && " · filigrane incrusté"}
          </p>

          <div className="grid grid-cols-3 gap-3 mt-8">
            {[
              [video.views, "lecture" + (video.views > 1 ? "s" : "")],
              [`${video.avgWatched} %`, "regardé en moyenne"],
              [video.downloadCount, "téléchargement" + (video.downloadCount > 1 ? "s" : "")],
            ].map(([n, label]) => (
              <div key={label as string} className="border border-line px-3 py-4 text-center">
                <p className="display text-2xl">{n}</p>
                <p className="text-[11px] text-muted mt-1">{label}</p>
              </div>
            ))}
          </div>

          <h3 className="label mt-10 mb-2">Commentaires du client</h3>
          <VideoComments
            mode="admin"
            comments={comments}
            onSeek={(t) => {
              player.current?.seek(t, true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onResolve={async (c) => {
              setComments((list) => list.map((x) => (x.id === c.id ? { ...x, resolved: !c.resolved } : x)));
              await setVideoCommentResolved(galleryId, c.id, !c.resolved);
            }}
            onDelete={async (c) => {
              if (!confirm("Supprimer ce commentaire ?")) return;
              setComments((list) => list.filter((x) => x.id !== c.id));
              await deleteVideoComment(galleryId, c.id);
            }}
          />
        </div>

        <aside>
          <div className="flex flex-col gap-3">
            <button
              className="btn"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "Lien copié ✓" : "Copier le lien de la vidéo"}
            </button>
            <a href={link} target="_blank" rel="noreferrer" className="btn btn-ghost text-center">Voir comme le client</a>
          </div>
          <p className="text-xs text-muted mt-3 leading-relaxed">Le lien ouvre directement cette vidéo (mot de passe de la galerie demandé s&apos;il y en a un).</p>
          <div className="mt-8">
            <Toggle
              checked={downloads}
              onChange={(v) => {
                setDownloads(v);
                void save({ downloads_enabled: v });
              }}
              label="Autoriser le téléchargement"
              hint="Désactivé : le client peut seulement regarder. Les téléchargements de la galerie doivent aussi être activés (Paramètres)."
            />
          </div>
          <button
            className="mt-10 text-sm text-danger hover:opacity-80"
            onClick={async () => {
              if (!confirm(`Supprimer définitivement « ${video.title} » ?`)) return;
              setBusy(true);
              await deleteVideo(galleryId, video.id);
              onBack();
              router.refresh();
            }}
          >
            Supprimer la vidéo
          </button>
        </aside>
      </div>
    </div>
  );
}
