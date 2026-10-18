import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { CreateBoardForm } from "@/components/admin/board-form";

export const metadata = { title: "Nouveau tableau" };
export const dynamic = "force-dynamic";

export default async function NewBoard({ searchParams }: { searchParams: Promise<{ gallery?: string }> }) {
  const { supabase } = await requireAdminPage();
  const [{ gallery }, { data }] = await Promise.all([
    searchParams,
    supabase.from("galleries").select("id, title, kind").is("deleted_at", null).order("created_at", { ascending: false }),
  ]);
  return (
    <div>
      <Link href="/admin/boards" className="eyebrow text-muted hover:text-ink">← Tableaux</Link>
      <h1 className="display text-4xl sm:text-5xl mt-6 mb-12">Nouveau tableau</h1>
      <CreateBoardForm galleries={(data ?? []) as { id: string; title: string; kind: string }[]} defaultGallery={gallery ?? ""} />
    </div>
  );
}
