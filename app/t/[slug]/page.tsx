import type { Metadata } from "next";
import { findSharedBoard } from "@/lib/boards";
import { SharedBoard } from "@/components/board/shared-board";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const board = await findSharedBoard((await params).slug);
  return { title: board ? board.title : "Tableau", robots: { index: false, follow: false } };
}

/** Tableau partagé avec le client : il voit tout et ajoute ses idées si le studio l'autorise. */
export default async function SharedBoardPage({ params }: { params: Promise<{ slug: string }> }) {
  return <SharedBoard slug={(await params).slug} />;
}
