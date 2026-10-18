import Link from "next/link";
import { notFound } from "next/navigation";
import { isStudioSession } from "@/lib/auth";
import { boardVisitor, clientActor, loadBoardItems, resolveSharedBoard } from "@/lib/boards";
import { createServiceClient } from "@/lib/supabase/server";
import { BoardCanvas } from "@/components/board/board-canvas";
import { Wordmark } from "@/components/wordmark";

/** Page client d'un tableau partagé (`/t/<lien>`) ou d'un de ses sous-tableaux (`/t/<lien>/b/<id>`). */
export async function SharedBoard({ slug, subId }: { slug: string; subId?: string }) {
  const shared = await resolveSharedBoard(slug, subId);
  if (!shared) notFound();
  const { root, board, path } = shared;
  const [items, visitor, studio] = await Promise.all([
    loadBoardItems(createServiceClient(), board.id, await clientActor(root)),
    boardVisitor(root),
    isStudioSession(), // c'est le studio qui regarde « comme le client » : chemin de retour
  ]);
  const query = board.id === root.id ? "" : `?board=${board.id}`;

  return (
    <div className="h-svh flex flex-col">
      <header className="shrink-0 flex items-center gap-4 h-14 sm:h-16 px-4 sm:px-6 border-b border-line bg-bg pt-[env(safe-area-inset-top)] box-content">
        {studio ? (
          <Link href="/admin" aria-label="Studio">
            <Wordmark height={24} />
          </Link>
        ) : (
          <Wordmark height={24} />
        )}
        <span className="w-px h-6 bg-line" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] sm:text-base truncate leading-tight">{board.title}</h1>
          {path.length > 1 ? (
            <nav className="flex items-center gap-1 text-[11px] text-muted whitespace-nowrap overflow-hidden">
              {path.slice(0, -1).map((b, i) => (
                <span key={b.id} className="flex items-center gap-1 min-w-0">
                  {i > 0 && <span className="opacity-50">/</span>}
                  <Link href={i === 0 ? `/t/${slug}` : `/t/${slug}/b/${b.id}`} className="hover:text-ink truncate max-w-[10rem]">
                    {b.title || "Sans titre"}
                  </Link>
                </span>
              ))}
            </nav>
          ) : (
            <p className="text-[11px] text-muted truncate">
              {root.client_can_add
                ? visitor
                  ? `Connecté(e) : ${visitor.name} · vos idées sont enregistrées automatiquement`
                  : "Ajoutez vos idées : notes, images, listes, liens"
                : "Tableau partagé par ALVZ.REC"}
            </p>
          )}
        </div>
        {studio && (
          <Link href={`/admin/boards/${board.id}`} className="btn btn-ghost shrink-0" title="Vous voyez le tableau comme votre client">
            <span className="hidden sm:inline">Retour au studio</span>
            <span className="sm:hidden">Studio</span>
          </Link>
        )}
      </header>
      <div className="flex-1 min-h-0">
        <BoardCanvas
          key={board.id}
          boardBase={`/t/${slug}/b/`}
          initialItems={items}
          endpoint={`/api/b/${slug}${query}`}
          imageEndpoint={`/api/b/${slug}/image${query}`}
          joinEndpoint={`/api/b/${slug}/join`}
          commentsEndpoint={`/api/b/${slug}/comments${query}`}
          clientEditAll={root.client_can_add && root.client_can_edit}
          role="client"
          canAdd={root.client_can_add}
          visitorName={visitor?.name ?? null}
        />
      </div>
    </div>
  );
}
