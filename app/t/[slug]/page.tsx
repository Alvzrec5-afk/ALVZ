import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { boardVisitor, clientActor, findSharedBoard, loadBoardItems } from "@/lib/boards";
import { createServiceClient } from "@/lib/supabase/server";
import { BoardCanvas } from "@/components/board/board-canvas";
import { Wordmark } from "@/components/wordmark";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const board = await findSharedBoard((await params).slug);
  return { title: board ? board.title : "Tableau", robots: { index: false, follow: false } };
}

/** Tableau partagé avec le client : il voit tout et ajoute ses idées si le studio l'autorise. */
export default async function SharedBoard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await findSharedBoard(slug);
  if (!board) notFound();
  const [items, visitor] = await Promise.all([
    loadBoardItems(createServiceClient(), board.id, await clientActor(board)),
    boardVisitor(board),
  ]);

  return (
    <div className="h-svh flex flex-col">
      <header className="shrink-0 flex items-center gap-4 h-14 sm:h-16 px-4 sm:px-6 border-b border-line bg-bg pt-[env(safe-area-inset-top)] box-content">
        <Wordmark height={24} />
        <span className="w-px h-6 bg-line" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] sm:text-base truncate leading-tight">{board.title}</h1>
          <p className="text-[11px] text-muted truncate">
            {board.client_can_add
              ? visitor
                ? `Connecté(e) : ${visitor.name} · vos idées sont enregistrées automatiquement`
                : "Ajoutez vos idées : notes, images, listes"
              : "Tableau partagé par ALVZ.REC"}
          </p>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        <BoardCanvas
          initialItems={items}
          endpoint={`/api/b/${slug}`}
          imageEndpoint={`/api/b/${slug}/image`}
          joinEndpoint={`/api/b/${slug}/join`}
          role="client"
          canAdd={board.client_can_add}
          visitorName={visitor?.name ?? null}
        />
      </div>
    </div>
  );
}
