import { getFavoriteListId, loadAccessibleGallery, setFavoriteListId } from "@/lib/gallery-access";
import { createServiceClient } from "@/lib/supabase/server";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Le client s'identifie par son e-mail (une seule fois) : crée ou retrouve sa sélection. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await loadAccessibleGallery(slug);
  if ("error" in access) return access.error;
  const { gallery } = access;
  // Même identification pour les favoris et pour le téléchargement (option « demander l'e-mail »).
  const forDownload = gallery.downloads_enabled && gallery.download_email_required;
  if (!gallery.favorites_enabled && !forDownload) return Response.json({ error: "Favoris désactivés" }, { status: 403 });

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const clean = String(email ?? "").trim().toLowerCase();
  if (!EMAIL.test(clean) || clean.length > 200) {
    return Response.json({ error: "Adresse e-mail invalide" }, { status: 400 });
  }
  const db = createServiceClient();
  const { data: list, error } = await db
    .from("favorite_lists")
    .upsert({ gallery_id: gallery.id, email: clean }, { onConflict: "gallery_id,email" })
    .select("id")
    .single();
  if (error || !list) return Response.json({ error: "Impossible d'enregistrer" }, { status: 500 });
  await setFavoriteListId(gallery, list.id);
  const { data: favs } = await db.from("favorites").select("photo_id").eq("list_id", list.id);
  return Response.json({ email: clean, photoIds: (favs ?? []).map((f) => f.photo_id) });
}

/** Ajoute ou retire un cœur. */
export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await loadAccessibleGallery(slug);
  if ("error" in access) return access.error;
  const { gallery } = access;
  if (!gallery.favorites_enabled) return Response.json({ error: "Favoris désactivés" }, { status: 403 });

  const listId = await getFavoriteListId(gallery);
  if (!listId) return Response.json({ error: "E-mail requis" }, { status: 401 });
  const { photoId, on } = (await req.json().catch(() => ({}))) as { photoId?: string; on?: boolean };
  if (!photoId) return Response.json({ error: "Requête invalide" }, { status: 400 });

  const db = createServiceClient();
  const { data: photo } = await db
    .from("photos")
    .select("id")
    .eq("id", photoId)
    .eq("gallery_id", gallery.id)
    .eq("status", "ready")
    .maybeSingle();
  if (!photo) return Response.json({ error: "Photo introuvable" }, { status: 404 });

  const { error } = on
    ? await db.from("favorites").upsert({ list_id: listId, photo_id: photoId }, { onConflict: "list_id,photo_id", ignoreDuplicates: true })
    : await db.from("favorites").delete().eq("list_id", listId).eq("photo_id", photoId);
  if (error) return Response.json({ error: "Impossible d'enregistrer" }, { status: 500 });
  return Response.json({ ok: true });
}
