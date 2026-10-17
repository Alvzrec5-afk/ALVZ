import "server-only";
import { presignGet, variantKey } from "@/lib/storage";
import type { PhotoRow, PhotoView } from "@/lib/types";

export const PHOTO_FIELDS =
  "id, gallery_id, collection_id, filename, original_ext, width, height, taken_at, position";

export async function toPhotoViews(rows: PhotoRow[], watermark: boolean): Promise<PhotoView[]> {
  return Promise.all(
    rows.map(async (p) => ({
      id: p.id,
      collectionId: p.collection_id,
      filename: p.filename,
      width: p.width || 3,
      height: p.height || 2,
      thumb: await presignGet(variantKey(p.gallery_id, p.id, watermark ? "thumb_wm" : "thumb")),
      web: await presignGet(variantKey(p.gallery_id, p.id, watermark ? "web_wm" : "web")),
    })),
  );
}

export function downloadName(p: Pick<PhotoRow, "filename" | "original_ext">) {
  const base = p.filename.replace(/\.[^.]+$/, "");
  return `${base}.${p.original_ext}`;
}
