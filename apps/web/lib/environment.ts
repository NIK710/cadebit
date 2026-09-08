const DEFAULT_AI_SERVICE_URL = "http://127.0.0.1:8000";

function readUrl(name: string, fallback: string): string {
  const value = process.env[name]?.trim() || fallback;

  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
}

/** Server-side settings used by the web application's backend code. */
export const serverEnvironment = Object.freeze({
  aiServiceUrl: readUrl("AI_SERVICE_URL", DEFAULT_AI_SERVICE_URL),
});
