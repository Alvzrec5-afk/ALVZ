import { Wordmark } from "@/components/wordmark";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="min-h-svh flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Wordmark height={72} />
        </div>
        <h1 className="display text-4xl text-center mt-10 mb-12">Espace studio</h1>
        <LoginForm initialError={error === "not-admin" ? "Ce compte n'a pas accès à l'espace studio." : null} />
      </div>
    </main>
  );
}
