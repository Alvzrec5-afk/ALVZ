"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { themeAttr, type GalleryDesign } from "@/lib/design";
import type { VideoComment, VideoView } from "@/lib/types";
import { ArrowLeft, DownloadIcon } from "@/components/icons";
import { Wordmark } from "@/components/wordmark";
import { VideoPlayer, formatTime, type PlayerHandle } from "@/components/video/video-player";
import { VideoComments } from "@/components/video/video-comments";
import { VideoCards, type VideoCard } from "./video-cards";

function formatSize(n: number) {
  return n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2).replace(".", ",")} Go` : `${Math.max(1, Math.round(n / 1024 ** 2))} Mo`;
}

export function VideoPage(props: {
  slug: string;
  galleryTitle: string;
  design: GalleryDesign;
  video: VideoView;
  comments: VideoComment[];
  others: VideoCard[];
}) {
  const { video, design, slug } = props;
  const player = useRef<PlayerHandle>(null);
  const [comments, setComments] = useState(props.comments);
  const [, setTick] = useState(0); // rafraîchit l'heure affichée dans le champ de commentaire
  const [highlight, setHighlight] = useState<string | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const token = useRef<string | null>(null);
  const api = `/api/g/${slug}/videos/${video.id}`;

  useEffect(() => {
    document.documentElement.dataset.theme = themeAttr(design);
    return () => {
      document.documentElement.dataset.theme = "auto";
    };
  }, [design]);

  const onPlayStart = useCallback(
    (quality: number) => {
      fetch(`${api}/event`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ start: true, quality }) })
        .then((r) => r.json())
        .then((j) => (token.current = j.token ?? null))
        .catch(() => undefined);
    },
    [api],
  );

  const onWatched = useCallback(
    (pct: number) => {
      if (!token.current) return;
      const body = new Blob([JSON.stringify({ token: token.current, pct })], { type: "application/json" });
      if (!navigator.sendBeacon?.(`${api}/event`, body)) void fetch(`${api}/event`, { method: "POST", body, keepalive: true });
    },
    [api],
  );

  async function post(c: { time: number; author: string; body: string }) {
    const res = await fetch(`${api}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Envoi impossible");
    setComments((list) => [...list, json as VideoComment]);
  }

  return (
    <div data-theme={themeAttr(design)} className={`fs-${design.font_style} min-h-svh bg-bg text-ink`}>
      <header className="sticky top-0 z-30 bg-bg/95 border-b border-line">
        <div className="mx-auto max-w-[1400px] h-14 sm:h-16 px-3 sm:px-8 grid grid-cols-[1fr_auto_1fr] items-center">
          <Link href={`/g/${slug}`} className="flex items-center gap-2 min-w-0 text-sm text-muted hover:text-ink">
            <ArrowLeft className="w-5 h-5 shrink-0" />
            <span className="truncate hidden sm:inline">{props.galleryTitle}</span>
          </Link>
          <Wordmark height={26} />
          <span />
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] sm:px-8 sm:pt-8 pb-24">
        <VideoPlayer
          ref={player}
          video={video}
          comments={comments}
          onTime={() => setTick((t) => (t + 1) % 1e6)}
          onMarker={(c) => {
            player.current?.seek(c.time_sec);
            setHighlight(c.id);
            document.getElementById(`c-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          onPlayStart={onPlayStart}
          onWatched={onWatched}
        />

        <div className="px-4 sm:px-0 mt-6 sm:mt-8 grid lg:grid-cols-[1fr_380px] gap-x-12 gap-y-10">
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="gallery-title text-2xl sm:text-4xl break-words">{video.title}</h1>
                <p className="eyebrow text-muted text-[10px] mt-2">ALVZ.REC · {formatTime(video.duration)}</p>
              </div>
              {video.downloads.length > 0 && (
                <div className="relative shrink-0">
                  {video.downloads.length === 1 ? (
                    <a href={`${api}/download?q=${video.downloads[0].quality}`} className="btn btn-ghost flex items-center gap-2">
                      <DownloadIcon className="w-4 h-4" /> Télécharger
                    </a>
                  ) : (
                    <button className="btn btn-ghost flex items-center gap-2" onClick={() => setDownloadOpen((o) => !o)}>
                      <DownloadIcon className="w-4 h-4" /> Télécharger
                    </button>
                  )}
                  {downloadOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setDownloadOpen(false)} />
                      <div className="absolute right-0 mt-1 z-20 w-60 bg-bg-soft border border-line py-1 shadow-xl text-sm">
                        {video.downloads.map((d) => (
                          <a key={d.quality} href={`${api}/download?q=${d.quality}`} className="flex justify-between px-4 py-3 hover:bg-bg" onClick={() => setDownloadOpen(false)}>
                            {d.label} <span className="text-muted">{formatSize(d.bytes)}</span>
                          </a>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {props.others.length > 0 && (
              <section className="mt-12 hidden lg:block">
                <h2 className="eyebrow text-muted mb-5">Autres vidéos</h2>
                <VideoCards slug={slug} videos={props.others} />
              </section>
            )}
          </div>

          <section>
            <h2 className="eyebrow text-muted mb-4">
              Commentaires {comments.length > 0 && <span className="ml-1">({comments.length})</span>}
            </h2>
            <VideoComments
              mode="client"
              comments={comments}
              highlight={highlight}
              onSeek={(t) => {
                player.current?.seek(t);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              getTime={() => player.current?.time() ?? 0}
              pause={() => player.current?.pause()}
              onPost={post}
            />
          </section>

          {props.others.length > 0 && (
            <section className="lg:hidden">
              <h2 className="eyebrow text-muted mb-5">Autres vidéos</h2>
              <VideoCards slug={slug} videos={props.others} />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
