import Link from "next/link";
import { formatTime } from "@/components/video/video-player";

export type VideoCard = { id: string; title: string; duration: number; poster: string };

/** Vignettes des vidéos d'une galerie : un clic ouvre le lecteur. */
export function VideoCards({ slug, videos }: { slug: string; videos: VideoCard[] }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-8">
      {videos.map((v) => (
        <li key={v.id}>
          <Link href={`/g/${slug}/v/${v.id}`} className="group block">
            <div className="relative aspect-video bg-bg-soft overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.poster} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
              <span className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/45 backdrop-blur-sm text-white flex items-center justify-center transition-transform group-hover:scale-110">
                <svg viewBox="0 0 24 24" className="w-6 h-6 ml-0.5" fill="currentColor" aria-hidden><path d="M7 4.5v15l12.5-7.5L7 4.5Z" /></svg>
              </span>
              <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[11px] tabular-nums px-1.5 py-0.5">{formatTime(v.duration)}</span>
            </div>
            <p className="gallery-title text-lg mt-3 truncate">{v.title}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
