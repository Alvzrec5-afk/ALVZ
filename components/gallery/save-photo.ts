/** Sur téléphone, on passe par le menu de partage (« Enregistrer l'image ») plutôt qu'un téléchargement classique. */
export function prefersShareSheet() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  );
}

export async function fetchPhotoFile(downloadHref: string): Promise<File> {
  const res = await fetch(`${downloadHref}&json=1`);
  const info = (await res.json().catch(() => ({}))) as { url?: string; name?: string; error?: string };
  if (!res.ok || !info.url) throw new Error(info.error || "Téléchargement impossible");
  const photo = await fetch(info.url);
  if (!photo.ok) throw new Error("Téléchargement impossible");
  const blob = await photo.blob();
  return new File([blob], info.name || "photo.jpg", { type: blob.type || "image/jpeg" });
}
