import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  serverExternalPackages: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner", "nodemailer"],
  // Une page du studio vue il y a moins de 30 s se réaffiche tout de suite (retour arrière, onglets…), sans redemander
  // au serveur ; les enregistrements (revalidatePath, router.refresh) la mettent quand même à jour.
  experimental: { staleTimes: { dynamic: 30, static: 180 } },
  // Service worker (hors connexion) : toujours relu, pour que chaque nouvelle version soit prise tout de suite.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
  // alvzrec.com (une fois le domaine relié à ce projet) affiche le site vitrine, servi par /site.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", has: [{ type: "host", value: "(?:www\\.)?alvzrec\\.com" }], destination: "/site" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
