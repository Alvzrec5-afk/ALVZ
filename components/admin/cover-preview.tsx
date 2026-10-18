import type { CoverLayout } from "@/lib/design";

/** Mini aperçu d'une mise en page de couverture, avec la vraie photo de la galerie. */
export function CoverPreview({ layout, src, src2, title }: { layout: CoverLayout; src: string | null; src2: string | null; title: string }) {
  const img = (cls = "", s: string | null = src) =>
    s ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={s} alt="" className={`object-cover ${cls}`} draggable={false} />
    ) : (
      <div className={`bg-muted/40 ${cls}`} />
    );
  const t = (cls = "") => <span className={`gallery-title text-[9px] leading-none truncate max-w-[80%] ${cls}`}>{title || "Titre"}</span>;
  const box = "relative aspect-[4/3] overflow-hidden bg-bg";

  switch (layout) {
    case "center":
      return (
        <div className={box}>
          {img("absolute inset-0 w-full h-full")}
          <div className="absolute inset-0 bg-black/25 flex items-center justify-center text-white">{t()}</div>
        </div>
      );
    case "bottom":
      return (
        <div className={box}>
          {img("absolute inset-0 w-full h-full")}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-2.5 text-white">{t()}</div>
        </div>
      );
    case "split":
      return (
        <div className={`${box} flex`}>
          <div className="w-1/2 flex items-center justify-center px-1">{t()}</div>
          <div className="w-1/2 p-1.5 pl-0">{img("w-full h-full")}</div>
        </div>
      );
    case "framed":
      return (
        <div className={`${box} p-2 flex flex-col items-center`}>
          {img("w-full h-[68%]")}
          <div className="flex-1 flex items-center">{t()}</div>
        </div>
      );
    case "frame":
      return (
        <div className={box}>
          {img("absolute inset-0 w-full h-full")}
          <div className="absolute inset-2 border border-white/90 flex items-center justify-center bg-black/15">{t()}</div>
        </div>
      );
    case "stripe":
      return (
        <div className={box}>
          {img("absolute inset-0 w-full h-full")}
          <div className="absolute inset-0 bg-black/25 flex flex-col justify-center px-3 gap-2 text-white">
            <span className="h-px bg-white/90" />
            {t()}
            <span className="h-px bg-white/90" />
          </div>
        </div>
      );
    case "divider":
      return (
        <div className={`${box} flex gap-[2px] bg-white`}>
          {img("w-1/2 h-full")}
          {img("w-1/2 h-full", src2 ?? src)}
          <div className="absolute inset-0 flex items-center justify-center text-white">{t()}</div>
        </div>
      );
    case "journal":
      return (
        <div className={`${box} p-2`}>
          {img("absolute left-2 top-2 w-[58%] h-[66%]")}
          <div className="absolute right-2 bottom-2.5 text-right">{t()}</div>
        </div>
      );
    case "stamp":
      return (
        <div className={`${box} flex flex-col items-center justify-center gap-2`}>
          {img("w-[34%] aspect-square")}
          {t()}
        </div>
      );
    case "outline":
      return (
        <div className={box}>
          {img("absolute inset-0 w-full h-full")}
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="border border-white/90 w-[48%] h-[70%] flex items-center justify-center text-white">{t()}</div>
          </div>
        </div>
      );
    case "classic":
      return (
        <div className={`${box} p-1.5 flex flex-col`}>
          {img("w-full h-[84%]")}
          <div className="flex-1 flex items-center justify-between px-1">
            {t("text-[7px]")}
            <span className="text-[6px] text-muted tracking-widest">♡ ↓</span>
          </div>
        </div>
      );
    case "none":
      return (
        <div className={`${box} border border-line`}>
          <svg className="absolute inset-0 w-full h-full text-line" preserveAspectRatio="none" viewBox="0 0 100 75" aria-hidden>
            <line x1="0" y1="75" x2="100" y2="0" stroke="currentColor" strokeWidth="0.6" />
          </svg>
        </div>
      );
  }
}
