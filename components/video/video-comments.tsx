"use client";

import { useEffect, useState } from "react";
import type { VideoComment } from "@/lib/types";
import { formatTime } from "./video-player";
import { useLang, useT } from "@/components/gallery/lang";


type Props = {
  comments: VideoComment[];
  highlight?: string | null;
  onSeek: (t: number) => void;
} & (
  | { mode: "client"; getTime: () => number; pause: () => void; onPost: (c: { time: number; author: string; body: string }) => Promise<void> }
  | { mode: "admin"; onResolve: (c: VideoComment) => void; onDelete: (c: VideoComment) => void }
);

/** Commentaires placés sur la timeline : un clic sur l'heure ramène la vidéo à ce moment. */
export function VideoComments(props: Props) {
  const t = useT();
  const lang = useLang();
  const dateFmt = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : lang === "pt" ? "pt-PT" : "fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
  const sorted = [...props.comments].sort((a, b) => a.time_sec - b.time_sec);
  return (
    <div>
      {props.mode === "client" && <Composer {...props} />}
      {sorted.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          {props.mode === "client" ? t("noCommentsClient") : t("noComments")}
        </p>
      ) : (
        <ul className="mt-2">
          {sorted.map((c) => (
            <li
              key={c.id}
              id={`c-${c.id}`}
              className={`flex gap-4 py-4 border-b border-line transition-colors ${c.resolved ? "opacity-50" : ""} ${props.highlight === c.id ? "bg-bg-soft" : ""}`}
            >
              <button onClick={() => props.onSeek(c.time_sec)} className="shrink-0 h-7 px-2 text-xs tabular-nums border border-line hover:border-ink transition-colors" title={t("goToMoment")}>
                {formatTime(c.time_sec)}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{c.author}</span>
                  <span className="text-xs text-muted ml-2">{dateFmt.format(new Date(c.created_at))}</span>
                  {c.resolved && <span className="text-xs text-accent ml-2">{t("resolved")}</span>}
                </p>
                <p className="text-[15px] mt-1 whitespace-pre-wrap break-words">{c.body}</p>
                {props.mode === "admin" && (
                  <div className="flex gap-4 mt-2 text-xs">
                    <button className="text-muted hover:text-ink" onClick={() => props.onResolve(c)}>{c.resolved ? "Rouvrir" : "Marquer comme traité"}</button>
                    <button className="text-muted hover:text-danger" onClick={() => props.onDelete(c)}>{t("delete")}</button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Composer({ getTime, pause, onPost }: { getTime: () => number; pause: () => void; onPost: (c: { time: number; author: string; body: string }) => Promise<void> }) {
  const t = useT();
  const [author, setAuthor] = useState("");
  const [knownAuthor, setKnownAuthor] = useState(false);
  const [body, setBody] = useState("");
  const [at, setAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("alvz-name");
      if (saved) {
        setAuthor(saved);
        setKnownAuthor(true);
      }
    } catch {}
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !author.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onPost({ time: at ?? getTime(), author: author.trim(), body: body.trim() });
      try {
        localStorage.setItem("alvz-name", author.trim());
      } catch {}
      setKnownAuthor(true);
      setBody("");
      setAt(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("sendFailed"));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="border border-line p-4 sm:p-5 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="h-7 px-2 shrink-0 whitespace-nowrap flex items-center text-xs tabular-nums bg-ink text-bg">à {formatTime(at ?? getTime())}</span>
        <span className="text-xs text-muted">{t("commentPlacedHere")}</span>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onFocus={() => {
          pause();
          setAt(getTime());
        }}
        placeholder={t("commentPlaceholder")}
        maxLength={1000}
        rows={3}
        className="w-full bg-transparent outline-none text-[15px] resize-none placeholder:text-muted"
      />
      <div className="flex flex-wrap items-center gap-3 mt-3">
        {!knownAuthor ? (
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder={t("firstName")}
            maxLength={60}
            required
            className="flex-1 min-w-[140px] bg-transparent border-b border-line focus:border-ink outline-none py-2 text-sm"
          />
        ) : (
          <button type="button" className="flex-1 text-left text-xs text-muted" onClick={() => setKnownAuthor(false)}>
            {t("signedBy", { name: author })}
          </button>
        )}
        <button className="btn" disabled={busy || !body.trim() || !author.trim()}>{busy ? t("sending") : t("publish")}</button>
      </div>
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </form>
  );
}
