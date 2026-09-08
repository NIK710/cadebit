import { afterEach, describe, expect, it, vi } from "vitest";

const originalAiServiceUrl = process.env.AI_SERVICE_URL;

afterEach(() => {
  if (originalAiServiceUrl === undefined) {
    delete process.env.AI_SERVICE_URL;
  } else {
    process.env.AI_SERVICE_URL = originalAiServiceUrl;
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
});
