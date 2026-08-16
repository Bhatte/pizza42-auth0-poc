import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config/environment.js";

describe("API environment configuration", () => {
  it("fails closed when security-critical configuration is missing", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(
      "Missing or invalid API environment configuration",
    );
  });
});
