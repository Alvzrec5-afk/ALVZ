import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { formatLongDate, toParisDateInput } from "@/lib/dates";
import { presignGet } from "@/lib/storage";
import { BoardIcon, PlusIcon } from "@/components/icons";
import { BoardsList, type BoardRow } from "@/components/admin/boards-list";

export const metadata = { title: "Tableaux" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  share_enabled: boolean;
  updated_at: string;
  cover_key: string | null;
  galleries: { title: string; kind: string } | null;
  board_items: { id: string; kind: string }[];
};

/** Tableaux façon Milanote : moodboards, listes de plans, préparation des tournages. */
export default async function BoardsHome() {
  const { supabase } = await requireAdminPage();
  const { data, error } = await supabase
    .from("boards")
    .select("id, title, share_enabled, updated_at, cover_key, galleries(title, kind), board_items(id, kind)")
    .is("parent_id", null)
    .is("deleted_at", null)
    .eq("is_template", false)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Impossible de charger les tableaux : ${error.message}`);

  const boards: BoardRow[] = await Promise.all(
    ((data ?? []) as unknown as Row[]).map(async (b) => {
      const cards = b.board_items.filter((i) => i.kind !== "arrow").length;
      return {
        id: b.id,
        title: b.title,
        cover: b.cover_key ? await presignGet(b.cover_key) : null,
        meta: [
          `${cards} carte${cards > 1 ? "s" : ""}`,
          b.galleries ? `${b.galleries.kind === "video" ? "Vidéo" : "Galerie"} ${b.galleries.title}` : "",
          b.share_enabled ? "Partagé" : "",
        ]
          .filter(Boolean)
          .join(" · "),
        updated: `Modifié le ${formatLongDate(toParisDateInput(b.updated_at))}`,
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

      {/* Modèle des nouveaux tableaux : ce qu'on y met se retrouve dans chaque nouveau tableau. */}
      <Link
        href="/admin/boards/model"
        className="mt-10 flex items-center gap-4 border border-line px-5 py-4 hover:border-muted transition-colors max-w-2xl"
      >
        <BoardIcon className="w-6 h-6 text-muted shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-[15px]">Modèle des nouveaux tableaux</span>
          <span className="block text-xs text-muted mt-0.5">
            Remplissez une fois votre check-list, votre budget, votre shot list… chaque nouveau tableau les aura déjà.
          </span>
        </span>
        <span className="text-xs text-muted shrink-0">Modifier →</span>
      </Link>

      {boards.length === 0 ? (
        <Link href="/admin/boards/new" className="mt-14 flex flex-col items-center justify-center gap-4 border border-dashed border-line py-20 text-muted hover:text-ink transition-colors">
          <BoardIcon className="w-8 h-8" />
          <span className="text-sm">Créer votre premier tableau</span>
        </Link>
      ) : (
        <BoardsList boards={boards} />
      )}
    </div>
  );
}
