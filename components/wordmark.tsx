/**
 * Logo ALVZ.REC (galeries et vidéos des clients) ou ALVZ .STUDIO (le studio, même style pochoir).
 * Deux fichiers chacun : blanc (fonds sombres, photos) et foncé (ambiances claires).
 * - tone="auto" : suit l'ambiance de la page (data-theme)
 * - tone="white" : toujours blanc (par-dessus une photo)
 * - tone="dark" : toujours foncé (document sur papier blanc, ex. un devis)
 */
export function Wordmark({
  className = "",
  height = 36,
  tone = "auto",
  variant = "rec",
}: {
  className?: string;
  height?: number;
  tone?: "auto" | "white" | "dark";
  variant?: "rec" | "studio";
}) {
  const style = { height, width: "auto" } as const;
  const file = variant === "studio" ? "studio-logo" : "logo";
  return (
    <span className={`inline-flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/brand/${file}-${tone === "dark" ? "dark" : "white"}.png`} alt={variant === "studio" ? "ALVZ Studio" : "ALVZ.REC"} style={style} className={tone === "auto" ? "logo-on-dark" : ""} draggable={false} />
      {tone === "auto" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/brand/${file}-dark.png`} alt="" aria-hidden style={style} className="logo-on-light" draggable={false} />
      )}
    </span>
  );
}
