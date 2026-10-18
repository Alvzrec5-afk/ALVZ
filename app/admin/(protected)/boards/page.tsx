import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { boardImageKey } from "@/lib/boards";
import { formatLongDate, toParisDateInput } from "@/lib/dates";
import { presignGet } from "@/lib/storage";
import { BoardIcon, PlusIcon } from "@/components/icons";
import { BoardCardMenu } from "@/components/admin/board-card-menu";

export const metadata = { title: "Tableaux" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  share_enabled: boolean;
  updated_at: string;
  galleries: { title: string; kind: string } | null;
  board_items: { id: string; kind: string; size_bytes: number; z: number }[];
};

/** Tableaux façon Milanote : moodboards, listes de plans, préparation des tournages. */
export default async function BoardsHome() {
  const { supabase } = await requireAdminPage();
  const { data, error } = await supabase
    .from("boards")
    .select("id, title, share_enabled, updated_at, galleries(title, kind), board_items(id, kind, size_bytes, z)")
    .is("parent_id", null)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Impossible de charger les tableaux : ${error.message}`);

  const boards = await Promise.all(
    ((data ?? []) as unknown as Row[]).map(async (b) => {
      const images = b.board_items.filter((i) => i.kind === "image" && i.size_bytes > 0).sort((x, y) => y.z - x.z);
      return {
        ...b,
        cards: b.board_items.filter((i) => i.kind !== "arrow").length,
        covers: await Promise.all(images.slice(0, 3).map((i) => presignGet(boardImageKey(b.id, i.id)))),
      };
    }),
  );

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl">Tableaux</h1>
          <p className="text-sm text-muted mt-3 max-w-lg leading-relaxed">
            Moodboards, listes de plans, préparation des shootings et tournages. Partagez-les avec vos clients pour qu&apos;ils
            ajoutent leurs idées.
          </p>
        </div>
        <Link href="/admin/boards/new" className="btn shrink-0">
          <PlusIcon className="w-4 h-4" /> <span className="hidden sm:inline">Nouveau tableau</span>
        </Link>
      </div>

      {boards.length === 0 ? (
        <Link href="/admin/boards/new" className="mt-14 flex flex-col items-center justify-center gap-4 border border-dashed border-line py-20 text-muted hover:text-ink transition-colors">
          <BoardIcon className="w-8 h-8" />
          <span className="text-sm">Créer votre premier tableau</span>
        </Link>
      ) : (
        <ul className="mt-12 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10">
          {boards.map((b) => (
            <li key={b.id} className="relative">
              <BoardCardMenu id={b.id} title={b.title} />
              <Link href={`/admin/boards/${b.id}`} className="group block">
                <div className="aspect-[4/3] bg-bg-soft overflow-hidden grid grid-cols-3 gap-px border border-line">
                  {b.covers.length ? (
                    b.covers.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={src} alt="" className={`w-full h-full object-cover ${b.covers.length === 1 ? "col-span-3" : i === 0 ? "col-span-2 row-span-2" : ""} ${b.covers.length === 2 && i === 1 ? "row-span-2" : ""}`} />
                    ))
                  ) : (
                    <span className="col-span-3 flex items-center justify-center text-muted group-hover:text-ink transition-colors">
                      <BoardIcon className="w-8 h-8" />
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[15px] truncate">{b.title}</p>
                <p className="text-xs text-muted mt-1 truncate">
                  {b.cards} carte{b.cards > 1 ? "s" : ""}
                  {b.galleries ? ` · ${b.galleries.kind === "video" ? "Vidéo" : "Galerie"} ${b.galleries.title}` : ""}
                  {b.share_enabled ? " · Partagé" : ""}
                </p>
                <p className="text-[11px] text-muted mt-0.5">Modifié le {formatLongDate(toParisDateInput(b.updated_at))}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
