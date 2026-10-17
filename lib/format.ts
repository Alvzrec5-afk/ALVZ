/** Taille toujours exprimée en Go (ex. « 0,43 Go »), pour suivre facilement la limite de stockage. */
export function formatBytes(n: number) {
  const gb = Math.max(0, n) / 1024 ** 3;
  if (gb > 0 && gb < 0.01) return "< 0,01 Go";
  return `${gb.toFixed(gb >= 100 ? 0 : 2).replace(".", ",")} Go`;
}
