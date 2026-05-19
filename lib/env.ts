/**
 * Centralised env access. Supports both Auth.js's `AUTH_MICROSOFT_ENTRA_ID_*`
 * naming convention AND the Azure-portal-natural naming (TENANT_ID,
 * APPLICATION_ID, CLIENT_SECRET_VALUE) for convenience.
 */

function read(key: string): string | undefined {
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}

function required(key: string): string {
  const v = read(key);
  if (!v) {
    throw new Error(`Missing required env: ${key}`);
  }
  return v;
}

/**
 * Multi-tenant by default: if no TENANT_ID is set, `common` lets any Microsoft
 * user (work, school, or personal) sign in. If the user pinned a specific
 * tenant in their App Registration we respect it.
 */
function msIssuer(): string {
  const explicit = read("AUTH_MICROSOFT_ENTRA_ID_ISSUER");
  if (explicit) return explicit;
  const tenant = read("TENANT_ID") ?? "common";
  return `https://login.microsoftonline.com/${tenant}/v2.0`;
}

export const env = {
  databaseUrl: () => required("DATABASE_URL"),
  geminiApiKey: () => read("GEMINI_API_KEY"),
  googleMapsApiKey: () => read("GOOGLE_MAPS_API_KEY"),
  maptilerApiKey: () => read("MAPTILER_API_KEY"),
  geocodeApiKey: () => read("GEOCODE_API"),

  // Auth.js
  authSecret: () => read("AUTH_SECRET"),
  authUrl: () => read("AUTH_URL") ?? "http://localhost:3000",

  // Microsoft Entra ID — read from either naming scheme
  msEntraId: () =>
    read("AUTH_MICROSOFT_ENTRA_ID_ID") ?? read("APPLICATION_ID"),
  msEntraSecret: () =>
    read("AUTH_MICROSOFT_ENTRA_ID_SECRET") ?? read("CLIENT_SECRET_VALUE"),
  msEntraIssuer: msIssuer,
  msTenantId: () => read("TENANT_ID") ?? "common",

  // Mailgun
  mailgunEndpoint: () => read("MAILGUN_ENDPOINT"),
  mailgunApiKey: () => read("MAILGUN_API_KEY"),
  mailgunSender: () => read("SHARED_MAILBOX_ADDRESS"),

  // BunnyCDN S3-compatible storage
  bunnyS3Endpoint: () => read("BUNNY_S3_REGION_ENDPOINT"),
  bunnyS3AccessKey: () => read("BUNNY_ACCESS_KEY"),
  bunnyS3SecretKey: () => read("BUNNY_S3_REGION_SECRET_KEY"),
  bunnyStorageZone: () => read("BUNNY_STORAGE_ZONE"),
  bunnyCdnHostname: () => read("BUNNY_CDN_HOSTNAME"),

  appUrl: () => read("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
};

export const flags = {
  hasMicrosoftAuth: () =>
    Boolean(env.msEntraId() && env.msEntraSecret()),
  hasMailgun: () =>
    Boolean(
      env.mailgunEndpoint() && env.mailgunApiKey() && env.mailgunSender(),
    ),
  hasAuthSecret: () => Boolean(env.authSecret()),
  hasBunnyStorage: () =>
    Boolean(
      env.bunnyS3Endpoint() &&
        env.bunnyS3AccessKey() &&
        env.bunnyS3SecretKey() &&
        env.bunnyStorageZone(),
    ),
};
