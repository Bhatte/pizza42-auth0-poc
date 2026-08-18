import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { onExecutePostLogin } = require("../actions/post-login.js");

// Same file the API suite asserts against. Asserting through the real Action
// contract rather than an exported helper means this also proves the claim
// actually reaches the ID token under the name the SPA reads.
const goldenCases = JSON.parse(
  readFileSync(
    new URL("../../fixtures/customer-profile-cases.json", import.meta.url),
    "utf8",
  ),
);

describe("Action profile derivation matches the API golden cases", () => {
  it.each(goldenCases.map((golden) => [golden.name, golden]))(
    "%s",
    async (_name, golden) => {
      const api = {
        idToken: { setCustomClaim: vi.fn() },
        accessToken: { setCustomClaim: vi.fn() },
      };

      await onExecutePostLogin(
        {
          user: {
            email_verified: true,
            app_metadata: { orders: golden.orders },
            identities: [{ provider: golden.identity_provider }],
          },
        },
        api,
      );

      expect(api.idToken.setCustomClaim).toHaveBeenCalledWith(
        "https://pizza42.com/customer_profile",
        golden.expected,
      );
    },
  );
});
