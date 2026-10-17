/**
 * Logo ALVZ.REC. Deux fichiers : blanc (fonds sombres, photos) et foncé (ambiances claires).
 * - tone="auto" : suit l'ambiance de la page (data-theme)
 * - tone="white" : toujours blanc (par-dessus une photo)
 */
export function Wordmark({
  className = "",
  height = 36,
  tone = "auto",
}: {
  className?: string;
  height?: number;
  tone?: "auto" | "white";
}) {
  const style = { height, width: "auto" } as const;
  return (
    <span className={`inline-flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-white.png" alt="ALVZ.REC" style={style} className={tone === "auto" ? "logo-on-dark" : ""} draggable={false} />
      {tone === "auto" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/brand/logo-dark.png" alt="" aria-hidden style={style} className="logo-on-light" draggable={false} />
      )}
    </span>
  );
}
