/** Lecture des fichiers et dossiers glissés-déposés. Un dossier = une collection. */

export type PickedFile = { file: File; collection: string | null };

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|avif)$/i;

export function isImage(file: File) {
  return !file.name.startsWith(".") && IMAGE_EXT.test(file.name);
}

function readAll(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const next = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) resolve(all);
        else {
          all.push(...batch);
          next();
        }
      }, reject);
    next();
  });
}

async function walk(entry: FileSystemEntry, parent: string | null, out: PickedFile[]) {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
    if (isImage(file)) out.push({ file, collection: parent });
  } else if (entry.isDirectory) {
    const children = await readAll((entry as FileSystemDirectoryEntry).createReader());
    for (const child of children) await walk(child, entry.name, out);
  }
}

export async function filesFromDrop(dt: DataTransfer): Promise<PickedFile[]> {
  const entries = Array.from(dt.items)
    .map((i) => (i.kind === "file" ? i.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => Boolean(e));
  if (entries.length === 0) {
    return Array.from(dt.files).filter(isImage).map((file) => ({ file, collection: null }));
  }
  const out: PickedFile[] = [];
  for (const e of entries) await walk(e, null, out);
  return out;
}

export function filesFromInput(list: FileList): PickedFile[] {
  return Array.from(list)
    .filter(isImage)
    .map((file) => {
      const parts = (file.webkitRelativePath || "").split("/");
      return { file, collection: parts.length > 1 ? parts[parts.length - 2] : null };
    });
}

export async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
