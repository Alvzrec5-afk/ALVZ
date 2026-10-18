import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: () => required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseSecretKey: () => required("SUPABASE_SECRET_KEY"),
  oracleNamespace: () => required("ORACLE_NAMESPACE"),
  oracleRegion: () => required("ORACLE_REGION"),
  oracleBucket: () => required("ORACLE_BUCKET"),
  oracleAccessKeyId: () => required("ORACLE_ACCESS_KEY_ID"),
  oracleSecretAccessKey: () => required("ORACLE_SECRET_ACCESS_KEY"),
  gallerySecret: () => required("GALLERY_SECRET"),
  /** Optionnel : adresse S3 personnalisée (sinon déduite du namespace et de la région). */
  oracleEndpoint: () => process.env.ORACLE_S3_ENDPOINT || null,
  /** Optionnel : boîte mail d'envoi (Gmail + mot de passe d'application). */
  smtp: () =>
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS.replace(/\s+/g, ""),
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: Number(process.env.SMTP_PORT || 465),
        }
      : null,
};
