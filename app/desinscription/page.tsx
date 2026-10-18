import { revalidatePath } from "next/cache";
import { readUnsubscribeToken } from "@/lib/audience";
import { createServiceClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/wordmark";

export const metadata = { title: "Désinscription", robots: { index: false } };
export const dynamic = "force-dynamic";

async function unsubscribe(form: FormData) {
  "use server";
  const email = readUnsubscribeToken(String(form.get("t") ?? ""));
  if (email) await createServiceClient().from("mail_unsubscribes").upsert({ email }, { onConflict: "email" });
  revalidatePath("/desinscription");
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string; ok?: string }> }) {
  const { t } = await searchParams;
  const email = readUnsubscribeToken(t);
  let done = false;
  if (email) {
    const { data } = await createServiceClient().from("mail_unsubscribes").select("email").eq("email", email).maybeSingle();
    done = Boolean(data);
  }
  return (
    <main className="min-h-svh flex flex-col items-center justify-center px-6 text-center">
      <Wordmark height={36} />
      <div className="mt-12 max-w-sm">
        {!email ? (
          <p className="text-sm text-muted">Ce lien n&apos;est pas valide.</p>
        ) : done ? (
          <>
            <h1 className="display text-3xl">C&apos;est noté</h1>
            <p className="text-sm text-muted mt-4">{email} ne recevra plus de messages d&apos;ALVZ.REC.</p>
          </>
        ) : (
          <form action={unsubscribe}>
            <input type="hidden" name="t" value={t} />
            <h1 className="display text-3xl">Se désinscrire</h1>
            <p className="text-sm text-muted mt-4">Ne plus recevoir de messages d&apos;ALVZ.REC à l&apos;adresse {email} ?</p>
            <button className="btn mt-8">Me désinscrire</button>
          </form>
        )}
      </div>
    </main>
  );
}
