export function formatBytes(n: number) {
  if (n < 1024 ** 2) return `${Math.max(0, Math.round(n / 1024))} Ko`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(n < 10 * 1024 ** 2 ? 1 : 0)} Mo`;
  return `${(n / 1024 ** 3).toFixed(n < 10 * 1024 ** 3 ? 2 : 1).replace(".", ",")} Go`;
}
