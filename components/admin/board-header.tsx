"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteBoard, duplicateBoard, regenerateBoardLink, updateBoard } from "@/app/admin/board-actions";
import { ArrowLeft, ChevronDown, CloseIcon } from "@/components/icons";
import { Toggle } from "./ui";

type Board = {
  id: string;
  title: string;
  gallery_id: string | null;
  share_slug: string;
  share_enabled: boolean;
  client_can_add: boolean;
  client_can_edit: boolean;
};

/**
 * Barre du haut d'un tableau : nom, galerie reliée, partage client.
 * Dans un sous-tableau : chemin depuis le tableau principal ; le partage est celui du tableau principal (`root`).
 */
export function BoardHeader({
  board,
  root,
  path,
  galleries,
}: {
  board: Board;
  root: Board;
  path: { id: string; title: string }[];
  galleries: { id: string; title: string; kind: string }[];
}) {
  const isSub = path.length > 1;
  const parent = isSub ? path[path.length - 2] : null;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState(board.title);
  const [share, setShare] = useState(false);
  const [plus, setPlus] = useState(false);
  const [opts, setOpts] = useState({ share_enabled: root.share_enabled, client_can_add: root.client_can_add, client_can_edit: root.client_can_edit });
  const [slug, setSlug] = useState(root.share_slug);
  const clientPath = isSub ? `/t/${slug}/b/${board.id}` : `/t/${slug}`;
  const [copied, setCopied] = useState(false);
  const gallery = galleries.find((g) => g.id === root.gallery_id);

  /** Le nom concerne ce tableau ; partage et galerie reliée, le tableau principal. */
  async function save(patch: Parameters<typeof updateBoard>[1]) {
    const res = await updateBoard(patch.title !== undefined ? board.id : root.id, patch);
    if (res.error) alert(res.error);
    else startTransition(() => router.refresh());
  }

  async function copy() {
    if (!opts.share_enabled) {
      setOpts((o) => ({ ...o, share_enabled: true }));
      await save({ share_enabled: true });
    }
    await navigator.clipboard.writeText(`${window.location.origin}${clientPath}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="shrink-0 flex items-center gap-2 sm:gap-3 h-14 sm:h-[64px] px-2 sm:px-4 border-b border-line bg-bg relative z-10 pt-[env(safe-area-inset-top)] box-content">
      <Link href={parent ? `/admin/boards/${parent.id}` : "/admin/boards"} className="icon-btn" aria-label="Retour">
        <ArrowLeft />
      </Link>
      <div className="min-w-0 flex-1">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== board.title && save({ title })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="w-full bg-transparent outline-none text-base sm:text-lg truncate leading-tight"
          aria-label="Nom du tableau"
        />
        {isSub ? (
          <nav className="flex items-center gap-1 text-[12px] text-muted min-w-0 overflow-hidden whitespace-nowrap">
            <Link href="/admin/boards" className="hover:text-ink shrink-0">Tableaux</Link>
            {path.slice(0, -1).map((b) => (
              <span key={b.id} className="flex items-center gap-1 min-w-0">
                <span className="opacity-50">/</span>
                <Link href={`/admin/boards/${b.id}`} className="hover:text-ink truncate max-w-[10rem]">{b.title || "Sans titre"}</Link>
              </span>
            ))}
          </nav>
        ) : gallery ? (
          <Link href={`/admin/galleries/${gallery.id}`} className="block text-[12px] text-muted hover:text-ink truncate">
            {gallery.kind === "video" ? "Projet vidéo" : "Galerie"} · {gallery.title}
          </Link>
        ) : (
          <button onClick={() => setShare(true)} className="block text-[12px] text-muted hover:text-ink">
            Relier à une galerie
          </button>
        )}
      </div>
      {copied && <span className="hidden sm:inline text-xs text-accent">Lien copié ✓</span>}
      <div className="relative">
        <button onClick={() => setPlus((o) => !o)} className="flex items-center gap-1 px-2 sm:px-3 h-10 text-sm text-muted hover:text-ink">
          <span className="hidden sm:inline">Plus</span> <ChevronDown className="w-4 h-4" />
        </button>
        {plus && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setPlus(false)} />
            <div className="absolute right-0 mt-1 z-20 w-60 bg-bg-soft border border-line py-1 shadow-xl text-sm">
              {opts.share_enabled && (
                <a className="block px-4 py-3 hover:bg-bg" href={clientPath} target="_blank" rel="noreferrer" onClick={() => setPlus(false)}>
                  Voir comme le client
                </a>
              )}
              <button
                className="block w-full text-left px-4 py-3 hover:bg-bg"
                onClick={async () => {
                  setPlus(false);
                  const name = prompt("Nom de la copie", `${title} (copie)`)?.trim();
                  if (!name) return;
                  const res = await duplicateBoard(board.id, name);
                  if (res.error) alert(res.error);
                  else if (res.id) router.push(`/admin/boards/${res.id}`);
                }}
              >
                Dupliquer le tableau
              </button>
              <button
                className="block w-full text-left px-4 py-3 hover:bg-bg"
                onClick={() => {
                  setPlus(false);
                  window.dispatchEvent(new Event("board:import"));
                }}
              >
                Importer depuis Milanote
              </button>
              <button className="block w-full text-left px-4 py-3 hover:bg-bg" onClick={() => { setShare(true); setPlus(false); }}>
                Partage et galerie reliée
              </button>
              {!isSub && <button
                className="block w-full text-left px-4 py-3 text-danger hover:bg-bg"
                onClick={() => {
                  setPlus(false);
                  if (confirm(`Mettre le tableau « ${board.title} » à la corbeille ? Vous pourrez le restaurer pendant 30 jours.`)) void deleteBoard(board.id);
                }}
              >
                Supprimer le tableau
              </button>}
            </div>
          </>
        )}
      </div>
      <button onClick={() => setShare(true)} className="btn">
        Partager
      </button>

      {share && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 animate-[fadeIn_0.2s_ease-out_both]" onClick={() => setShare(false)} />
          <aside className="relative h-full w-full max-w-sm bg-bg border-l border-line px-6 pt-[max(env(safe-area-inset-top),1rem)] overflow-y-auto animate-[slideIn_0.25s_ease-out_both]">
            <div className="flex items-center justify-between h-12">
              <span className="eyebrow text-muted">Partage</span>
              <button className="icon-btn -mr-2" onClick={() => setShare(false)} aria-label="Fermer">
                <CloseIcon />
              </button>
            </div>
            {isSub && (
              <p className="mt-3 text-xs text-muted leading-relaxed">
                Ce tableau est rangé dans « {path[0].title} » : il suit son partage. Le lien ci-dessous ouvre directement ce tableau.
              </p>
            )}
            <div className="mt-4">
              <Toggle
                checked={opts.share_enabled}
                onChange={(v) => {
                  setOpts((o) => ({ ...o, share_enabled: v }));
                  void save({ share_enabled: v });
                }}
                label="Partager avec le client"
                hint="Toute personne qui a le lien peut voir le tableau. Le lien est impossible à deviner."
              />
              <Toggle
                checked={opts.client_can_add}
                onChange={(v) => {
                  setOpts((o) => ({ ...o, client_can_add: v }));
                  void save({ client_can_add: v });
                }}
                label="Le client peut ajouter ses idées"
                hint="Notes, images, listes, liens et commentaires, signés de son prénom."
              />
              {opts.client_can_add && (
                <Toggle
                  checked={opts.client_can_edit}
                  onChange={(v) => {
                    setOpts((o) => ({ ...o, client_can_edit: v }));
                    void save({ client_can_edit: v });
                  }}
                  label="Le client peut tout modifier"
                  hint="Il peut aussi déplacer, modifier, cocher et supprimer vos cartes, et ajouter colonnes, couleurs et flèches. Désactivé : il ne touche qu'à ses propres cartes."
                />
              )}
            </div>
            {opts.share_enabled && (
              <div className="mt-8">
                <p className="label">Lien client</p>
                <p className="text-sm break-all mt-2 select-all">{typeof window !== "undefined" ? window.location.origin : ""}{clientPath}</p>
                <div className="flex gap-2 mt-4">
                  <button className="btn flex-1" onClick={copy}>{copied ? "Copié ✓" : "Copier le lien"}</button>
                  <a className="btn btn-ghost" href={clientPath} target="_blank" rel="noreferrer">Ouvrir</a>
                </div>
                <button
                  className="mt-4 text-xs text-muted hover:text-ink underline underline-offset-2"
                  onClick={async () => {
                    if (!confirm("Créer un nouveau lien ? L'ancien ne fonctionnera plus.")) return;
                    const res = await regenerateBoardLink(root.id);
                    if (res.slug) setSlug(res.slug);
                    else if (res.error) alert(res.error);
                  }}
                >
                  Changer le lien
                </button>
              </div>
            )}
            <div className="mt-10">
              <label className="label" htmlFor="board-gallery">Galerie ou projet vidéo relié</label>
              <select
                id="board-gallery"
                defaultValue={board.gallery_id ?? ""}
                onChange={(e) => void save({ gallery_id: e.target.value || null })}
                className="field"
              >
                <option value="">Aucun</option>
                {galleries.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.kind === "video" ? "Vidéo · " : ""}{g.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted mt-2 leading-relaxed">Le tableau s&apos;ouvre aussi depuis la galerie (menu « Plus »).</p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
