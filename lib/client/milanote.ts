/**
 * Import d'un tableau Milanote, à partir de ses exports :
 * - « Export → Markdown » (ou « Texte ») : titres → colonnes, paragraphes → notes, cases à cocher → listes ;
 * - « Export → Generate ZIP » : toutes les images (un dossier du ZIP → une colonne).
 * Milanote ne documente pas son format : la lecture est volontairement tolérante.
 */
import type { TodoEntry } from "@/lib/board-types";

export type ImportCard =
  | { kind: "note"; text: string }
  | { kind: "todo"; title: string; items: TodoEntry[] }
  | { kind: "link"; url: string; title: string };
export type ImportGroup = { title: string | null; cards: ImportCard[] };

const CHECK = /^\s*(?:[-*+]|\d+[.)])?\s*(?:\[( |x|X)\]|(☐|☑|✓|✔|☒))\s+(.*)$/;
const HEADING = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const IMAGE = /!\[[^\]]*\]\([^)]*\)/g;

/** Retire la mise en forme Markdown, garde les adresses des liens (cliquables dans les notes). */
function plain(line: string) {
  return line
    .replace(IMAGE, "")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)[^)]*\)/g, (_, t: string, u: string) => (t === u ? u : `${t} ${u}`))
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*])[*_](\S.*?\S|\S)[*_](?=[^\w*]|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*>\s?/, "")
    .replace(/^\s*[-*+]\s+/, "• ")
    .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, "$1")
    .trimEnd();
}

const uid = () => crypto.randomUUID();

function blockToCard(lines: string[]): ImportCard | null {
  const checks = lines.map((l) => CHECK.exec(l));
  if (checks.some(Boolean)) {
    const title = lines
      .filter((_, i) => !checks[i])
      .map(plain)
      .join(" ")
      .trim();
    const items = checks.flatMap((m) => (m ? [{ id: uid(), text: plain(m[3]).slice(0, 500), done: Boolean(m[1]?.trim() || m[2] === "☑" || m[2] === "✓" || m[2] === "✔" || m[2] === "☒") }] : []));
    return { kind: "todo", title: title.slice(0, 200), items };
  }
  // Une ligne qui n'est qu'un lien (YouTube, Spotify…) → carte lien, avec son lecteur.
  if (lines.length === 1) {
    const one = lines[0].trim();
    const md = /^\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/.exec(one);
    if (md) return { kind: "link", url: md[2], title: md[1] === md[2] ? "" : md[1].slice(0, 200) };
    if (/^<?https?:\/\/\S+>?$/.test(one)) return { kind: "link", url: one.replace(/^<|>$/g, ""), title: "" };
  }
  const text = lines.map(plain).join("\n").trim();
  return text ? { kind: "note", text: text.slice(0, 5000) } : null;
}

/** Texte exporté → groupes de cartes. Un titre suivi de plusieurs cartes devient une colonne. */
export function parseMilanoteText(source: string): { groups: ImportGroup[]; skippedImages: number } {
  const skippedImages = (source.match(IMAGE) ?? []).length;
  const sections: { title: string | null; blocks: string[][] }[] = [{ title: null, blocks: [] }];
  let block: string[] = [];
  const close = () => {
    if (block.some((l) => l.trim())) sections[sections.length - 1].blocks.push(block);
    block = [];
  };
  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const h = HEADING.exec(raw);
    if (h) {
      close();
      sections.push({ title: plain(h[1]), blocks: [] });
    } else if (!raw.trim() || RULE.test(raw)) {
      close();
    } else block.push(raw);
  }
  close();

  const groups: ImportGroup[] = [];
  const loose: ImportCard[] = [];
  for (const s of sections) {
    const cards = s.blocks.map(blockToCard).filter((c): c is ImportCard => Boolean(c));
    if (s.title && cards.length >= 2) groups.push({ title: s.title, cards });
    else if (s.title && cards.length === 1 && cards[0].kind === "todo" && !cards[0].title) loose.push({ ...cards[0], title: s.title });
    else if (s.title && cards.length === 1 && cards[0].kind === "note") loose.push({ kind: "note", text: `${s.title}\n${cards[0].text}` });
    else if (s.title && cards.length === 0) loose.push({ kind: "note", text: s.title });
    else loose.push(...cards);
  }
  if (loose.length) groups.unshift({ title: null, cards: loose });
  return { groups, skippedImages };
}

// ——— Lecture d'un ZIP dans le navigateur (sans bibliothèque) ———

export type ZipEntry = { path: string; file: File };

/** Liste les fichiers d'un ZIP (méthodes « stocké » et « deflate »), en ignorant les fichiers système. */
export async function readZip(zip: File): Promise<ZipEntry[]> {
  const buf = new Uint8Array(await zip.arrayBuffer());
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // Fin du répertoire central : signature 0x06054b50, cherchée depuis la fin.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Fichier ZIP illisible");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const utf8 = new TextDecoder();
  const out: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const path = utf8.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    const base = path.split("/").pop() ?? "";
    if (!base || path.endsWith("/") || path.startsWith("__MACOSX/") || base.startsWith(".")) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = buf.slice(start, start + compSize);
    let bytes: BlobPart;
    if (method === 0) bytes = data;
    else if (method === 8) bytes = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
    else continue;
    out.push({ path, file: new File([bytes], base, { type: mimeOf(base) }) });
  }
  return out;
}

function mimeOf(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  return (
    { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", avif: "image/avif", md: "text/markdown", txt: "text/plain" }[
      ext ?? ""
    ] ?? "application/octet-stream"
  );
}

export const isImageName = (name: string) => /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(name);
export const isTextName = (name: string) => /\.(md|markdown|txt)$/i.test(name);

/** Images du ZIP rangées par dossier (le dossier racine du ZIP, souvent le nom du tableau, est ignoré). */
export function groupZipImages(entries: ZipEntry[]) {
  const images = entries.filter((e) => isImageName(e.path)).sort((a, b) => a.path.localeCompare(b.path, "fr", { numeric: true }));
  const dirs = images.map((e) => e.path.split("/").slice(0, -1));
  // Préfixe commun à tous (ex. « Mon tableau/ ») : ne crée pas de colonne pour lui.
  let common = dirs[0]?.length ?? 0;
  for (const d of dirs) {
    let i = 0;
    while (i < common && i < d.length && d[i] === dirs[0][i]) i++;
    common = i;
  }
  const groups = new Map<string, File[]>();
  images.forEach((e, i) => {
    const key = dirs[i].slice(common).join(" / ");
    groups.set(key, [...(groups.get(key) ?? []), e.file]);
  });
  return [...groups.entries()].map(([title, files]) => ({ title: title || null, files }));
}
