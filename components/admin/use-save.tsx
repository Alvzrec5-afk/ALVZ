"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateGallerySettings } from "@/app/admin/actions";

/** Enregistre un réglage immédiatement et affiche « Enregistré ». */
export function useSave(galleryId: string) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(patch: Record<string, unknown>) {
    setStatus("saving");
    const res = await updateGallerySettings(galleryId, patch);
    if (res.error) {
      setStatus("error");
      alert(res.error);
      return false;
    }
    setStatus("saved");
    startTransition(() => router.refresh());
    setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1800);
    return true;
  }

  return { save, status };
}

export function SaveStatus({ status }: { status: ReturnType<typeof useSave>["status"] }) {
  if (status === "idle") return null;
  return (
    <span className={`text-xs ${status === "error" ? "text-danger" : "text-muted"}`}>
      {status === "saving" ? "Enregistrement…" : status === "saved" ? "Enregistré ✓" : "Erreur"}
    </span>
  );
}
