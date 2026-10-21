import { requireAdminPage } from "@/lib/auth";
import type { Contact } from "@/lib/contact";
import { PHOTO_CATEGORIES, loadSiteContent } from "@/lib/site";
import { SiteManager } from "@/components/admin/site-manager";

export const metadata = { title: "Site" };
export const dynamic = "force-dynamic";

/** Studio → Site : clips, photos, coulisses et matériel du site alvzrec.com. */
export default async function SitePage() {
  const { supabase } = await requireAdminPage();
  const [content, { data: studio }] = await Promise.all([loadSiteContent(supabase), supabase.from("studio_settings").select("contact").eq("id", 1).maybeSingle()]);
  const group = (slug: string) => content.photos.filter((p) => p.slug === slug).map((p) => ({ id: p.id, slug: p.slug, thumb: p.thumb }));
  return (
    <SiteManager
      clips={content.clips}
      photos={content.photos.filter((p) => (PHOTO_CATEGORIES as readonly string[]).includes(p.slug)).map((p) => ({ id: p.id, slug: p.slug, thumb: p.thumb }))}
      groups={{ coulisses: group("coulisses"), materiel: group("materiel") }}
      kit={content.kit}
      whatsapp={((studio?.contact as Contact | null)?.whatsapp ?? "") as string}
    />
  );
}
