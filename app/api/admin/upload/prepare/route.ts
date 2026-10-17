import type { SupabaseClient } from "@supabase/supabase-js";
import { apiError, requireAdminApi } from "@/lib/auth";
import { formatBytes } from "@/lib/format";
import { storageUsage } from "@/lib/usage";
import {
  MULTIPART_THRESHOLD,
  PART_SIZE,
  VARIANTS,
  abortMultipart,
  createMultipart,
  listUploadedParts,
  originalKey,
  presignPart,
  presignPut,
  variantKey,
} from "@/lib/storage";

type Body = {
  galleryId: string;
  collectionName: string;
  filename: string;
  hash: string;
  size: number;
  type: string;
  takenAt: string | null;
};

async function findOrCreateCollection(supabase: SupabaseClient, galleryId: string, name: string) {
  const find = () =>
    supabase.from("collections").select("id").eq("gallery_id", galleryId).eq("name", name).maybeSingle();
  const existing = await find();
  if (existing.data) return existing.data.id as string;
  const { data: last } = await supabase
    .from("collections")
    .select("position")
    .eq("gallery_id", galleryId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("collections")
    .insert({ gallery_id: galleryId, name, position: (last?.position ?? -1) + 1 })
    .select("id")
    .single();
  if (data) return data.id as string;
  // Deux envois en parallèle ont créé la même collection : on relit.
  if (error?.code === "23505") {
    const again = await find();
    if (again.data) return again.data.id as string;
  }
  throw new Error(error?.message ?? "Impossible de créer la collection");
}

function extensionOf(filename: string) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(filename);
  return m ? m[1].toLowerCase() : "jpg";
}

export async function POST(req: Request) {
  try {
    const { supabase } = await requireAdminApi();
    const body = (await req.json()) as Body;
    if (!/^[a-f0-9]{64}$/.test(body.hash) || !body.galleryId || !body.filename || !(body.size > 0)) {
      return Response.json({ error: "Requête invalide" }, { status: 400 });
    }
    const collectionName = (body.collectionName || "Galerie").trim().slice(0, 120) || "Galerie";
    const takenAt = body.takenAt && !Number.isNaN(Date.parse(body.takenAt)) ? body.takenAt : null;

    const { data: gallery } = await supabase.from("galleries").select("id").eq("id", body.galleryId).maybeSingle();
    if (!gallery) return Response.json({ error: "Galerie introuvable" }, { status: 404 });

    // Détection des doublons : même contenu (empreinte SHA-256) déjà présent dans la galerie.
    const { data: existing } = await supabase
      .from("photos")
      .select("id, status, original_ext, multipart_upload_id, size_bytes")
      .eq("gallery_id", body.galleryId)
      .eq("content_hash", body.hash)
      .maybeSingle();
    if (existing?.status === "ready") return Response.json({ duplicate: true });

    // Limite de stockage : on refuse l'envoi plutôt que de dépasser l'offre Oracle.
    const usage = await storageUsage(supabase);
    const estimate = body.size + 1_200_000; // original + déclinaisons
    if (usage.total + estimate > usage.limit) {
      return Response.json(
        { error: `Stockage plein (${formatBytes(usage.total)} sur ${formatBytes(usage.limit)}). Supprimez d'anciennes galeries pour libérer de la place.` },
        { status: 413 },
      );
    }

    const collectionId = await findOrCreateCollection(supabase, body.galleryId, collectionName);
    const ext = extensionOf(body.filename);
    const contentType = body.type || "application/octet-stream";
    const row = {
      collection_id: collectionId,
      filename: body.filename.slice(0, 255),
      original_ext: ext,
      original_type: contentType,
      size_bytes: body.size,
      taken_at: takenAt,
      position: takenAt ? Date.parse(takenAt) : Date.now(),
    };

    let photoId: string;
    let uploadId: string | null = null;
    if (existing) {
      // Envoi précédent interrompu : on reprend la même photo.
      photoId = existing.id;
      const sameFile = existing.original_ext === ext && Number(existing.size_bytes) === body.size;
      if (existing.multipart_upload_id && sameFile) uploadId = existing.multipart_upload_id;
      else if (existing.multipart_upload_id) {
        await abortMultipart(originalKey(body.galleryId, photoId, existing.original_ext), existing.multipart_upload_id);
      }
      await supabase.from("photos").update(row).eq("id", photoId);
    } else {
      const { data, error } = await supabase
        .from("photos")
        .insert({ ...row, gallery_id: body.galleryId, content_hash: body.hash, status: "uploading" })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Insertion impossible");
      photoId = data.id;
    }

    const variants = Object.fromEntries(
      await Promise.all(
        VARIANTS.map(async (v) => [v, await presignPut(variantKey(body.galleryId, photoId, v), "image/jpeg")] as const),
      ),
    );

    const key = originalKey(body.galleryId, photoId, ext);
    if (body.size <= MULTIPART_THRESHOLD) {
      return Response.json({
        photoId,
        variants,
        original: { kind: "single", url: await presignPut(key, contentType), contentType },
      });
    }

    const partCount = Math.ceil(body.size / PART_SIZE);
    let done: number[] = [];
    if (uploadId) {
      try {
        done = await listUploadedParts(key, uploadId);
      } catch {
        uploadId = null; // envoi expiré côté Oracle : on recommence l'original
      }
    }
    if (!uploadId) {
      uploadId = await createMultipart(key, contentType);
      await supabase.from("photos").update({ multipart_upload_id: uploadId }).eq("id", photoId);
    }
    const parts = await Promise.all(
      Array.from({ length: partCount }, (_, i) => i + 1)
        .filter((n) => !done.includes(n))
        .map(async (n) => ({ partNumber: n, url: await presignPart(key, uploadId!, n) })),
    );
    return Response.json({
      photoId,
      variants,
      original: { kind: "multipart", partSize: PART_SIZE, partCount, parts },
    });
  } catch (e) {
    return apiError(e);
  }
}
