import type { Metadata } from "next";

/** Le studio peut s'installer comme une appli (Safari → Fichier → Ajouter au Dock). */
export const metadata: Metadata = {
  manifest: "/studio.webmanifest",
  appleWebApp: { capable: true, title: "ALVZ Studio", statusBarStyle: "black-translucent" },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
