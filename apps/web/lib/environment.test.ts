import { afterEach, describe, expect, it, vi } from "vitest";

const originalAiServiceUrl = process.env.AI_SERVICE_URL;
const originalAiServiceToken = process.env.AI_SERVICE_TOKEN;
const originalAiServiceTimeoutMs = process.env.AI_SERVICE_TIMEOUT_MS;

afterEach(() => {
  if (originalAiServiceUrl === undefined) {
    delete process.env.AI_SERVICE_URL;
  } else {
    process.env.AI_SERVICE_URL = originalAiServiceUrl;
  }
  if (originalAiServiceToken === undefined) {
    delete process.env.AI_SERVICE_TOKEN;
  } else {
    process.env.AI_SERVICE_TOKEN = originalAiServiceToken;
  }
  if (originalAiServiceTimeoutMs === undefined) {
    delete process.env.AI_SERVICE_TIMEOUT_MS;
  } else {
    process.env.AI_SERVICE_TIMEOUT_MS = originalAiServiceTimeoutMs;
  }

  vi.resetModules();
});

describe("serverEnvironment", () => {
  it("uses the local AI service URL by default", async () => {
    delete process.env.AI_SERVICE_URL;

    const { serverEnvironment } = await import("./environment");

    expect(serverEnvironment.aiServiceUrl).toBe("http://127.0.0.1:8000");
  });

  it("rejects an invalid AI service URL", async () => {
    process.env.AI_SERVICE_URL = "not-a-url";

    await expect(import("./environment")).rejects.toThrow(
      "AI_SERVICE_URL must be a valid absolute URL.",
    );
  });

  it("reads the server-only AI service credentials and timeout", async () => {
    process.env.AI_SERVICE_TOKEN = "service-secret";
    process.env.AI_SERVICE_TIMEOUT_MS = "12000";

    const { serverEnvironment } = await import("./environment");

    expect(serverEnvironment.aiServiceToken).toBe("service-secret");
    expect(serverEnvironment.aiServiceTimeoutMs).toBe(12000);
  });

  it("rejects a non-positive AI service timeout", async () => {
    process.env.AI_SERVICE_TIMEOUT_MS = "0";

    await expect(import("./environment")).rejects.toThrow(
      "AI_SERVICE_TIMEOUT_MS must be a positive integer.",
    );
  });
});
