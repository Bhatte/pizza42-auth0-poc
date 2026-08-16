import { afterEach, describe, expect, it, vi } from "vitest";

const validEnvironment = {
  VITE_AUTH0_DOMAIN: "pizza42.eu.auth0.com",
  VITE_AUTH0_CLIENT_ID: "client-id",
  VITE_AUTH0_AUDIENCE: "https://api.pizza42.com",
  VITE_API_BASE_URL: "https://api.pizza42.example",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("web configuration", () => {
  it("loads an explicit, immutable runtime contract", async () => {
    for (const [name, value] of Object.entries(validEnvironment)) {
      vi.stubEnv(name, value);
    }

    const { webConfig } = await import("../src/config.js");

    expect(webConfig).toEqual({
      auth0Domain: "pizza42.eu.auth0.com",
      auth0ClientId: "client-id",
      auth0Audience: "https://api.pizza42.com",
      apiBaseUrl: "https://api.pizza42.example",
    });
    expect(Object.isFrozen(webConfig)).toBe(true);
  });

  it("fails closed when a required value is absent", async () => {
    for (const [name, value] of Object.entries(validEnvironment)) {
      if (name !== "VITE_AUTH0_DOMAIN") vi.stubEnv(name, value);
    }
    vi.stubEnv("VITE_AUTH0_DOMAIN", "");

    await expect(import("../src/config.js")).rejects.toThrow(
      "Missing required web configuration: VITE_AUTH0_DOMAIN",
    );
  });
});
