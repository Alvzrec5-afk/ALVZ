import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  serverExternalPackages: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner", "nodemailer"],
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
