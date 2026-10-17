import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { formatLongDate } from "@/lib/dates";
import { presignGet, variantKey } from "@/lib/storage";
import { StorageCheck } from "@/components/admin/storage-check";

export const metadata = { title: "Galeries" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  event_date: string | null;
  cover_photo_id: string | null;
  password_hash: string | null;
  expires_at: string | null;
  created_at: string;
  photos: { count: number }[];
};

export default async function AdminHome() {
  const { supabase } = await requireAdminPage();
  const { data, error } = await supabase
    .from("galleries")
    .select("id, title, event_date, cover_photo_id, password_hash, expires_at, created_at, photos(count)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Impossible de charger les galeries : ${error.message}`);
  const galleries = (data ?? []) as Row[];
  const covers = await Promise.all(
    galleries.map((g) => (g.cover_photo_id ? presignGet(variantKey(g.id, g.cover_photo_id, "thumb")) : null)),
  );

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-12">
        <div>
          <p className="eyebrow text-muted mb-3">Studio</p>
          <h1 className="display text-5xl">Galeries</h1>
        </div>
        <Link href="/admin/galleries/new" className="btn">Nouvelle galerie</Link>
      </div>

      {galleries.length === 0 ? (
        <div className="border border-line py-24 text-center">
          <p className="display text-2xl">Aucune galerie pour l&apos;instant</p>
          <p className="text-sm text-muted mt-3">Créez votre première galerie client.</p>
        </div>
      ) : (
        <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {galleries.map((g, i) => {
            const expired = g.expires_at && new Date(g.expires_at) < new Date();
            return (
              <li key={g.id}>
                <Link href={`/admin/galleries/${g.id}`} className="group block">
                  <div className="aspect-[4/3] bg-bg-soft overflow-hidden">
                    {covers[i] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={covers[i]!} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                    )}
                  </div>
                  <div className="mt-4 flex items-baseline justify-between gap-3">
                    <h2 className="display text-2xl truncate">{g.title}</h2>
                    <span className="text-xs text-muted shrink-0">{g.photos[0]?.count ?? 0} photos</span>
                  </div>
                  <p className="text-xs text-muted mt-1 flex gap-3">
                    <span>{formatLongDate(g.event_date) || "Sans date"}</span>
                    {g.password_hash && <span>· Protégée</span>}
                    {expired && <span className="text-danger">· Expirée</span>}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-24 border-t border-line pt-8">
        <StorageCheck />
      </div>
    </div>
  );
}
