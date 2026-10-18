/** Affiché instantanément au clic, le temps que la page arrive. */
export default function Loading() {
  return (
    <div className="animate-[fadeIn_0.3s_ease-out_0.1s_both]" aria-busy="true" aria-label="Chargement">
      <div className="h-10 w-48 bg-bg-soft animate-pulse" />
      <ul className="mt-12 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i}>
            <div className="aspect-square lg:aspect-[4/3] bg-bg-soft animate-pulse" />
            <div className="mt-3 h-4 w-2/3 bg-bg-soft animate-pulse" />
          </li>
        ))}
      </ul>
    </div>
  );
}
