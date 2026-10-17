import { Wordmark } from "@/components/wordmark";

export default function NotFound() {
  return (
    <main className="min-h-svh flex flex-col items-center justify-center px-6 text-center">
      <Wordmark />
      <h1 className="display text-4xl sm:text-5xl mt-16">Page introuvable</h1>
      <p className="mt-6 text-sm text-muted max-w-xs">Ce lien n&apos;existe pas ou n&apos;est plus actif.</p>
    </main>
  );
}
