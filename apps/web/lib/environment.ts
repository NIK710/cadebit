const DEFAULT_AI_SERVICE_URL = "http://127.0.0.1:8000";
const DEFAULT_AI_SERVICE_TIMEOUT_MS = 35_000;

function readUrl(name: string, fallback: string): string {
  const value = process.env[name]?.trim() || fallback;

  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
}

function readPositiveInteger(name: string, fallback: number): number {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const rawValue = process.env[name]?.trim().toLowerCase();
  if (!rawValue) return fallback;
  if (rawValue === "true") return true;
  if (rawValue === "false") return false;
  throw new Error(`${name} must be true or false.`);
}

/** Server-side settings used by the web application's backend code. */
export const serverEnvironment = Object.freeze({
  aiServiceUrl: readUrl("AI_SERVICE_URL", DEFAULT_AI_SERVICE_URL),
  aiServiceToken: process.env.AI_SERVICE_TOKEN?.trim() || null,
  aiServiceTimeoutMs: readPositiveInteger(
    "AI_SERVICE_TIMEOUT_MS",
    DEFAULT_AI_SERVICE_TIMEOUT_MS,
  ),
  materialPipelineVersion:
    process.env.MATERIAL_PIPELINE_VERSION?.trim() || "v1",
  objectStorage: Object.freeze({
    endpoint: process.env.S3_ENDPOINT?.trim() || "http://127.0.0.1:9000",
    region: process.env.S3_REGION?.trim() || "us-east-1",
    bucket: process.env.S3_BUCKET?.trim() || "cadebit-materials",
    accessKey: process.env.S3_ACCESS_KEY?.trim() || "cadebit",
    secretKey:
      process.env.S3_SECRET_KEY?.trim() || "cadebit-local-storage-secret",
    forcePathStyle: readBoolean("S3_FORCE_PATH_STYLE", true),
  }),
});
