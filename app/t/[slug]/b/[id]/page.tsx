import type { Metadata } from "next";
import { resolveSharedBoard } from "@/lib/boards";
import { SharedBoard } from "@/components/board/shared-board";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; id: string }> }): Promise<Metadata> {
  const { slug, id } = await params;
  const shared = await resolveSharedBoard(slug, id);
  return { title: shared ? shared.board.title : "Tableau", robots: { index: false, follow: false } };
}

/** Sous-tableau d'un tableau partagé. */
export default async function SharedSubBoardPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  return <SharedBoard slug={slug} subId={id} />;
}
