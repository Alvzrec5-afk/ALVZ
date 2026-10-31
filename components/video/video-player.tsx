"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { VideoComment, VideoView } from "@/lib/types";
import { useT } from "@/components/gallery/lang";

export type PlayerHandle = { seek: (t: number, play?: boolean) => void; pause: () => void; time: () => number };

type Props = {
  video: VideoView;
  comments?: VideoComment[];
  onTime?: (t: number) => void;
  onMarker?: (c: VideoComment) => void;
  /** Lecture commencée (première fois), part regardée, qualité utilisée. */
  onPlayStart?: (quality: number) => void;
  onWatched?: (pct: number) => void;
};

export const qualityLabel = (h: number) => (h >= 2160 ? "4K" : `${h}p`);

export const formatTime = (s: number) => {
  const t = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

type NetworkInfo = { downlink?: number; saveData?: boolean };

/**
 * Lecteur vidéo : qualité choisie automatiquement selon la connexion et la taille
 * de l'écran (et ajustée en cours de lecture), commentaires sur la barre de lecture.
 */
export const VideoPlayer = forwardRef<PlayerHandle, Props>(function VideoPlayer({ video, comments = [], onTime, onMarker, onPlayStart, onWatched }, ref) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const el = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const sources = video.sources; // de la meilleure à la plus légère
  const bitrate = useCallback((i: number) => (sources[i].bytes * 8) / Math.max(1, video.duration), [sources, video.duration]);

  const [mode, setMode] = useState<"auto" | number>("auto");
  const [level, setLevel] = useState(() => Math.min(1, sources.length - 1)); // 720p par défaut avant mesure
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [menu, setMenu] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const duration = video.duration;
  const pendingSeek = useRef<{ t: number; play: boolean } | null>(null);
  const stalls = useRef<number[]>([]);
  const lastSeek = useRef(0);
  const sample = useRef<{ at: number; end: number } | null>(null);
  const maxWatched = useRef(0);
  const reportedStart = useRef(false);

  // Qualité de départ : connexion annoncée par le navigateur + largeur réelle du lecteur.
  const cap = useCallback(() => {
    const width = (box.current?.clientWidth ?? 1280) * Math.min(2, window.devicePixelRatio || 1);
    const short = Math.min(video.width, video.height);
    const scale = (h: number) => (video.width >= video.height ? (video.width * h) / short : h);
    const i = sources.findIndex((s) => scale(s.h) <= width * 1.4);
    return i === -1 ? sources.length - 1 : i;
  }, [sources, video.width, video.height]);

  useEffect(() => {
    const net = (navigator as Navigator & { connection?: NetworkInfo }).connection;
    let start = Math.min(1, sources.length - 1);
    if (net?.saveData) start = sources.length - 1;
    else if (net?.downlink) {
      const fit = sources.findIndex((_, i) => bitrate(i) * 1.6 < net.downlink! * 1e6);
      start = fit === -1 ? sources.length - 1 : fit;
    }
    setLevel(Math.max(start, cap()));
  }, [sources, bitrate, cap]);

  // Page client : les adresses des fichiers sont demandées au serveur (elles ne sont pas dans la page).
  const [streamed, setStreamed] = useState<Record<string, string> | null>(null);
  const fetchedAt = useRef(0);
  const loadStream = useCallback(async () => {
    if (!video.stream) return;
    fetchedAt.current = Date.now();
    const res = await fetch(video.stream, { method: "POST", headers: { "x-alvz-player": "1" }, cache: "no-store" }).catch(() => null);
    const json = res?.ok ? ((await res.json().catch(() => null)) as { urls?: Record<string, string> } | null) : null;
    if (json?.urls) setStreamed(json.urls);
  }, [video.stream]);
  useEffect(() => {
    void loadStream();
  }, [loadStream]);

  const current = mode === "auto" ? level : Math.max(0, sources.findIndex((s) => s.h === mode));
  const src = sources[current]?.url || streamed?.[String(sources[current]?.h)] || undefined;

  // Changement de qualité : on reprend exactement au même moment.
  const switchTo = useCallback((i: number) => {
    const v = el.current;
    if (v && v.currentSrc) pendingSeek.current = { t: v.currentTime, play: !v.paused };
    setLevel(i);
  }, []);

  useImperativeHandle(ref, () => ({
    seek(t, play = false) {
      const v = el.current;
      if (!v) return;
      lastSeek.current = performance.now();
      v.currentTime = Math.max(0, Math.min(duration, t));
      setTime(v.currentTime);
      if (play) void v.play();
    },
    pause: () => el.current?.pause(),
    time: () => el.current?.currentTime ?? 0,
  }));

  // Adaptation en cours de lecture (mode automatique).
  useEffect(() => {
    if (mode !== "auto") return;
    const timer = setInterval(() => {
      const v = el.current;
      if (!v || v.paused || v.buffered.length === 0) return;
      const now = performance.now();
      let end = 0;
      for (let i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= v.currentTime + 0.5) end = Math.max(end, v.buffered.end(i));
      const ahead = end - v.currentTime;
      const prev = sample.current;
      sample.current = { at: now, end };
      stalls.current = stalls.current.filter((t) => now - t < 30_000);
      if (!prev || ahead > 50 || end < prev.end || now - lastSeek.current < 4000) return;
      // Vitesse de téléchargement ≈ secondes de vidéo reçues par seconde × débit de la qualité actuelle.
      const speed = ((end - prev.end) / ((now - prev.at) / 1000)) * bitrate(level);
      const up = level - 1;
      if (up >= cap() && up >= 0 && stalls.current.length === 0 && ahead > 12 && speed > bitrate(up) * 1.5) switchTo(up);
    }, 4000);
    return () => clearInterval(timer);
  }, [mode, level, bitrate, cap, switchTo]);

  function onWaiting() {
    setWaiting(true);
    const now = performance.now();
    if (mode !== "auto" || now - lastSeek.current < 1500 || !started) return;
    stalls.current.push(now);
    // Deux coupures en 30 s : qualité inférieure.
    if (stalls.current.length >= 2 && level < sources.length - 1) {
      stalls.current = [];
      switchTo(level + 1);
    }
  }

  // Fin de chargement d'une nouvelle qualité : reprise au même endroit.
  function onLoadedMetadata() {
    const v = el.current;
    const p = pendingSeek.current;
    if (!v || !p) return;
    pendingSeek.current = null;
    v.currentTime = p.t;
    if (p.play) void v.play();
  }

  function onTimeUpdate() {
    const v = el.current;
    if (!v) return;
    setTime(v.currentTime);
    onTime?.(v.currentTime);
    if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
    const pct = Math.round((v.currentTime / Math.max(1, duration)) * 100);
    if (pct > maxWatched.current) maxWatched.current = pct;
  }

  useEffect(() => {
    const flush = () => maxWatched.current > 0 && onWatched?.(maxWatched.current);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [onWatched]);

  function toggle() {
    const v = el.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  function fullscreen() {
    const v = el.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) return void document.exitFullscreen();
    if (box.current?.requestFullscreen) void box.current.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.());
    else v?.webkitEnterFullscreen?.(); // iPhone
  }

  function timeAt(clientX: number) {
    const r = bar.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * duration;
  }

  function scrub(e: React.PointerEvent) {
    const v = el.current;
    if (!v) return;
    lastSeek.current = performance.now();
    v.currentTime = timeAt(e.clientX);
    setTime(v.currentTime);
  }

  // Barre de commandes masquée après 2,5 s sans mouvement pendant la lecture.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const poke = useCallback(() => {
    setChrome(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChrome(false), 2500);
  }, []);
  useEffect(() => () => clearTimeout(hideTimer.current), []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea")) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const markers = useMemo(() => comments.filter((c) => !c.resolved), [comments]);
  const showChrome = chrome || !playing || menu;
  const label = (i: number) => qualityLabel(sources[i].h);

  return (
    <div
      ref={box}
      className="relative bg-black select-none overflow-hidden group"
      style={{ aspectRatio: `${video.width} / ${video.height}`, maxHeight: "82svh", marginInline: "auto" }}
      onPointerMove={poke}
      onContextMenu={(e) => e.preventDefault()}
    >
      <video
        ref={el}
        src={src}
        poster={video.poster}
        playsInline
        preload="metadata"
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        className="absolute inset-0 w-full h-full object-contain"
        onClick={toggle}
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
          poke();
          if (!reportedStart.current) {
            reportedStart.current = true;
            onPlayStart?.(sources[current].h);
          }
        }}
        onPause={() => setPlaying(false)}
        onWaiting={onWaiting}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onLoadedMetadata={onLoadedMetadata}
        onError={() => {
          // Adresse expirée (page restée ouverte longtemps) : on en redemande, au même moment de la vidéo.
          const v = el.current;
          if (!video.stream || Date.now() - fetchedAt.current < 30_000) return;
          if (v) pendingSeek.current = { t: v.currentTime, play: !v.paused };
          void loadStream();
        }}
        onTimeUpdate={onTimeUpdate}
        onProgress={() => {
          const v = el.current;
          if (v?.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onVolumeChange={() => setMuted(Boolean(el.current?.muted))}
        onEnded={() => {
          maxWatched.current = 100;
          onWatched?.(100);
        }}
      />

      {video.overlayWatermark && <div aria-hidden className="absolute inset-0 pointer-events-none video-watermark" />}

      {(!started || (waiting && playing)) && (
        <button
          onClick={toggle}
          className="absolute inset-0 m-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/45 backdrop-blur-sm text-white flex items-center justify-center"
          aria-label={t("play")}
        >
          {waiting && started ? (
            <span className="w-7 h-7 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" className="w-7 h-7 ml-1" fill="currentColor" aria-hidden><path d="M7 4.5v15l12.5-7.5L7 4.5Z" /></svg>
          )}
        </button>
      )}

      {/* Barre de commandes */}
      <div
        className={`absolute inset-x-0 bottom-0 px-3 sm:px-4 pt-10 pb-2 sm:pb-3 bg-gradient-to-t from-black/75 to-transparent text-white transition-opacity duration-300 ${showChrome ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <div
          ref={bar}
          className="relative h-6 flex items-center cursor-pointer touch-none"
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            scrub(e);
          }}
          onPointerMove={(e) => {
            setHover(timeAt(e.clientX));
            if (e.buttons) scrub(e);
          }}
          onPointerLeave={() => setHover(null)}
        >
          <div className="relative w-full h-[3px] bg-white/25 rounded-full">
            <div className="absolute inset-y-0 left-0 bg-white/35 rounded-full" style={{ width: `${(buffered / Math.max(1, duration)) * 100}%` }} />
            <div className="absolute inset-y-0 left-0 bg-white rounded-full" style={{ width: `${(time / Math.max(1, duration)) * 100}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white" style={{ left: `${(time / Math.max(1, duration)) * 100}%` }} />
          </div>
          {markers.map((c) => (
            <button
              key={c.id}
              title={`${formatTime(c.time_sec)} · ${c.author} : ${c.body}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onMarker?.(c);
              }}
              className="absolute -top-2.5 -translate-x-1/2 w-4 h-4 flex items-center justify-center"
              style={{ left: `${(c.time_sec / Math.max(1, duration)) * 100}%` }}
              aria-label={t("commentAt", { time: formatTime(c.time_sec) })}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-black/40" />
            </button>
          ))}
          {hover !== null && (
            <span className="absolute -top-7 -translate-x-1/2 text-[11px] bg-black/80 px-1.5 py-0.5 rounded pointer-events-none" style={{ left: `${(hover / Math.max(1, duration)) * 100}%` }}>
              {formatTime(hover)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2 text-[13px]">
          <button onClick={toggle} className="w-9 h-9 flex items-center justify-center" aria-label={playing ? t("pause") : t("play")}>
            {playing ? (
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden><path d="M7 4.5v15l12.5-7.5L7 4.5Z" /></svg>
            )}
          </button>
          <button
            onClick={() => {
              if (el.current) el.current.muted = !el.current.muted;
            }}
            className="w-9 h-9 flex items-center justify-center"
            aria-label={muted ? t("unmute") : t("mute")}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor" />
              {muted ? <path d="M16 9.5l5 5m0-5-5 5" /> : <path d="M16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />}
            </svg>
          </button>
          <span className="tabular-nums text-white/90">
            {formatTime(time)} <span className="text-white/50">/ {formatTime(duration)}</span>
          </span>
          <span className="flex-1" />
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="h-9 px-2 flex items-center gap-1 tabular-nums" aria-label={t("quality")}>
              {mode === "auto" ? <>Auto <span className="text-white/60">{label(current)}</span></> : label(current)}
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <div className="absolute right-0 bottom-11 z-20 w-40 bg-black/90 backdrop-blur py-1 text-sm rounded">
                  <p className="px-4 pt-2 pb-1 text-[11px] text-white/50 uppercase tracking-wider">{t("quality")}</p>
                  {(["auto", ...sources.map((s) => s.h)] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        const v = el.current;
                        const next = q === "auto" ? level : sources.findIndex((s) => s.h === q);
                        if (v && v.currentSrc && next !== current) pendingSeek.current = { t: v.currentTime, play: !v.paused };
                        setMode(q);
                        setMenu(false);
                      }}
                      className={`block w-full text-left px-4 py-2 hover:bg-white/10 ${mode === q ? "text-white" : "text-white/70"}`}
                    >
                      {mode === q ? "✓ " : ""}
                      {q === "auto" ? t("automatic") : qualityLabel(q)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={fullscreen} className="w-9 h-9 flex items-center justify-center" aria-label={t("fullscreen")}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});
