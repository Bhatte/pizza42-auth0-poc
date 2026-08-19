import { createRequire } from "node:module";

import { describe, expect, it, vi } from "vitest";

import { deriveCustomerProfile } from "../../api/src/domain/customer-profile.js";

const require = createRequire(import.meta.url);
const { onExecutePostLogin } = require("../actions/post-login.js");

function createOrders(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `ord_${index + 1}`,
    placed_at: `2026-08-${String(index + 1).padStart(2, "0")}T18:00:00.000Z`,
    store: index % 2 === 0 ? "Dublin Camden Street" : "Dublin Rathmines",
    items: [{ name: index % 3 === 0 ? "Margherita" : "Garden Veg", qty: 1 }],
    total: 10 + index,
  }));
}

describe("Action profile derivation matches the API contract", () => {
  it.each([
    ["new database customer", 0, "auth0"],
    ["occasional social customer", 1, "google-oauth2"],
    ["returning customer", 4, "auth0"],
    ["loyal customer", 10, "auth0"],
  ])("%s", async (_name, orderCount, identityProvider) => {
    const orders = createOrders(orderCount);
    const api = {
      idToken: { setCustomClaim: vi.fn() },
      accessToken: { setCustomClaim: vi.fn() },
    };

    await onExecutePostLogin(
      {
        user: {
          email_verified: true,
          app_metadata: { orders },
          identities: [{ provider: identityProvider }],
        },
      },
      api,
    );

    expect(api.idToken.setCustomClaim).toHaveBeenCalledWith(
      "https://pizza42.com/customer_profile",
      deriveCustomerProfile(orders, { identityProvider }),
    );
  });
});
