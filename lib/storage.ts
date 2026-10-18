import "server-only";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

/** Les déclinaisons stockées pour chaque photo. */
export const VARIANTS = ["thumb", "thumb_wm", "web", "web_wm"] as const;
export type Variant = (typeof VARIANTS)[number];

/** Au-delà de cette taille, l'original est envoyé en plusieurs morceaux (reprise possible). */
export const MULTIPART_THRESHOLD = 20 * 1024 * 1024;
export const PART_SIZE = 10 * 1024 * 1024;

let client: S3Client | null = null;

function s3() {
  if (!client) {
    client = new S3Client({
      region: env.oracleRegion(),
      endpoint:
        env.oracleEndpoint() ??
        `https://${env.oracleNamespace()}.compat.objectstorage.${env.oracleRegion()}.oraclecloud.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.oracleAccessKeyId(),
        secretAccessKey: env.oracleSecretAccessKey(),
      },
      // Oracle ne gère pas les sommes de contrôle automatiques du SDK AWS récent.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}

const bucket = () => env.oracleBucket();

export function photoPrefix(galleryId: string, photoId: string) {
  return `galleries/${galleryId}/${photoId}`;
}

export function variantKey(galleryId: string, photoId: string, variant: Variant) {
  return `${photoPrefix(galleryId, photoId)}/${variant}.jpg`;
}

export function originalKey(galleryId: string, photoId: string, ext: string) {
  return `${photoPrefix(galleryId, photoId)}/original.${ext}`;
}

export function allKeys(galleryId: string, photoId: string, ext: string) {
  return [...VARIANTS.map((v) => variantKey(galleryId, photoId, v)), originalKey(galleryId, photoId, ext)];
}

/** Vidéos : galleries/<galerie>/videos/<vidéo>/{original.ext, 2160.mp4, 1080.mp4, 720.mp4, 480.mp4, poster.jpg} */
export const RENDITION_HEIGHTS = [2160, 1080, 720, 480] as const;

export function videoKey(galleryId: string, videoId: string, name: string) {
  return `galleries/${galleryId}/videos/${videoId}/${name}`;
}

export function videoKeys(galleryId: string, videoId: string, ext: string) {
  return [`original.${ext}`, "poster.jpg", ...RENDITION_HEIGHTS.map((h) => `${h}.mp4`)].map((n) => videoKey(galleryId, videoId, n));
}

const UPLOAD_TTL = 60 * 60 * 2; // 2 h pour envoyer un fichier

export function presignPut(key: string, contentType: string) {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), {
    expiresIn: UPLOAD_TTL,
  });
}

/**
 * URL de lecture temporaire. L'heure de signature est arrondie à l'heure pleine :
 * l'URL reste identique pendant une heure, ce qui permet au navigateur de garder
 * les images en cache au lieu de les retélécharger à chaque visite.
 */
export function presignGet(key: string, opts: { downloadName?: string } = {}) {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const signingDate = new Date(Math.floor(now / hour) * hour);
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: opts.downloadName
        ? `attachment; filename="${opts.downloadName.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "_")}"`
        : undefined,
    }),
    { expiresIn: 3 * 60 * 60, signingDate },
  );
}

/** Petit fichier déjà vérifié par le serveur (ex. image ajoutée par un client sur un tableau). */
export async function putObject(key: string, body: Uint8Array, contentType: string) {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
}

/** Taille d'un fichier (0 s'il n'existe pas). */
export async function objectSize(key: string) {
  try {
    const head = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return Number(head.ContentLength ?? 0);
  } catch {
    return 0;
  }
}

/** Copie un fichier dans le même bucket, sans le faire transiter par le serveur (duplication d'un tableau). */
export async function copyObject(from: string, to: string) {
  await s3().send(
    new CopyObjectCommand({
      Bucket: bucket(),
      Key: to,
      CopySource: `${bucket()}/${from.split("/").map(encodeURIComponent).join("/")}`,
    }),
  );
}

export async function createMultipart(key: string, contentType: string) {
  const res = await s3().send(
    new CreateMultipartUploadCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
  );
  if (!res.UploadId) throw new Error("Oracle n'a pas renvoyé d'identifiant d'envoi");
  return res.UploadId;
}

export function presignPart(key: string, uploadId: string, partNumber: number) {
  return getSignedUrl(
    s3(),
    new UploadPartCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, PartNumber: partNumber }),
    { expiresIn: UPLOAD_TTL },
  );
}

/** Termine l'envoi en plusieurs morceaux à partir des morceaux réellement reçus par Oracle. */
export async function completeMultipart(key: string, uploadId: string, expectedParts: number) {
  const parts: { PartNumber: number; ETag: string }[] = [];
  let marker: string | undefined;
  do {
    const res = await s3().send(
      new ListPartsCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, PartNumberMarker: marker }),
    );
    for (const p of res.Parts ?? []) {
      if (p.PartNumber && p.ETag) parts.push({ PartNumber: p.PartNumber, ETag: p.ETag });
    }
    marker = res.IsTruncated ? res.NextPartNumberMarker : undefined;
  } while (marker);
  if (parts.length !== expectedParts) {
    throw new Error(`Envoi incomplet : ${parts.length}/${expectedParts} morceaux reçus`);
  }
  parts.sort((a, b) => a.PartNumber - b.PartNumber);
  await s3().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }),
  );
}

/** Numéros des morceaux déjà reçus par Oracle (pour reprendre un envoi interrompu). */
export async function listUploadedParts(key: string, uploadId: string) {
  const done: number[] = [];
  let marker: string | undefined;
  do {
    const res = await s3().send(
      new ListPartsCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, PartNumberMarker: marker }),
    );
    for (const p of res.Parts ?? []) if (p.PartNumber) done.push(p.PartNumber);
    marker = res.IsTruncated ? res.NextPartNumberMarker : undefined;
  } while (marker);
  return done;
}

export async function abortMultipart(key: string, uploadId: string) {
  try {
    await s3().send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: key, UploadId: uploadId }));
  } catch {
    // Déjà terminé ou annulé : rien à faire.
  }
}

export async function deleteKeys(keys: string[]) {
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    try {
      await s3().send(
        new DeleteObjectsCommand({
          Bucket: bucket(),
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    } catch {
      // Repli : suppression une par une, 20 en parallèle.
      for (let j = 0; j < chunk.length; j += 20) {
        await Promise.all(
          chunk
            .slice(j, j + 20)
            .map((Key) => s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key })).catch(() => undefined)),
        );
      }
    }
  }
}
