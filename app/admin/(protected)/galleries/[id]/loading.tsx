/** Squelette de la page galerie, affiché instantanément au clic. */
export default function Loading() {
  return (
    <div className="lg:h-svh lg:flex lg:flex-col animate-[fadeIn_0.3s_ease-out_0.1s_both]" aria-busy="true" aria-label="Chargement">
      <div className="h-10 lg:h-[72px] lg:border-b lg:border-line flex items-center lg:px-6">
        <div className="h-5 w-40 bg-bg-soft animate-pulse" />
      </div>
      <div className="lg:flex lg:flex-1">
        <div className="hidden lg:block w-80 border-r border-line">
          <div className="aspect-[16/10] bg-bg-soft animate-pulse" />
        </div>
        <ul className="flex-1 pt-6 lg:p-10 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 lg:gap-6 content-start">
          {Array.from({ length: 10 }, (_, i) => (
            <li key={i} className="aspect-square bg-bg-soft animate-pulse" />
          ))}
        </ul>
      </div>
    </div>
  );
}
