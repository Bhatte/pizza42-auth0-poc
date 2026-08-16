import { createRequire } from "node:module";

import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { onExecutePostLogin } = require("../actions/post-login.js");

function createApi() {
  return {
    idToken: { setCustomClaim: vi.fn() },
    accessToken: { setCustomClaim: vi.fn() },
  };
}

describe("Post-Login Action", () => {
  it("issues explicit claims for a new unverified customer", async () => {
    const api = createApi();
    const event = {
      user: {
        email_verified: false,
        app_metadata: {},
        identities: [{ provider: "auth0" }],
      },
    };

    await onExecutePostLogin(event, api);

    expect(api.accessToken.setCustomClaim).toHaveBeenCalledWith(
      "https://pizza42.com/email_verified",
      false,
    );
    expect(api.idToken.setCustomClaim).toHaveBeenCalledWith(
      "https://pizza42.com/email_verified",
      false,
    );
    expect(api.idToken.setCustomClaim).toHaveBeenCalledWith(
      "https://pizza42.com/orders",
      [],
    );
    expect(api.idToken.setCustomClaim).toHaveBeenCalledWith(
      "https://pizza42.com/customer_profile",
      {
        customer_segment: "New Customer",
        order_count: 0,
        favourite_item: null,
        favourite_store: null,
        last_item_ordered: null,
        last_order_at: null,
        average_order_value: 0,
        identity_provider: "auth0",
      },
    );
  });

  it("derives returning-customer traits from trusted app metadata", async () => {
    const api = createApi();
    const orders = [
      {
        id: "ord_1",
        placed_at: "2026-08-01T18:00:00.000Z",
        store: "Dublin Camden Street",
        items: [{ name: "Margherita" }],
        total: 14.5,
      },
      {
        id: "ord_2",
        placed_at: "2026-08-03T18:00:00.000Z",
        store: "Dublin Camden Street",
        items: [{ name: "Margherita" }],
        total: 18,
      },
      {
        id: "ord_3",
        placed_at: "2026-08-02T18:00:00.000Z",
        store: "Dublin Rathmines",
        items: [{ name: "Garlic Bread" }],
        total: 4.5,
      },
      {
        id: "ord_4",
        placed_at: "2026-08-04T18:00:00.000Z",
        store: "Dublin Camden Street",
        items: [{ name: "Margherita" }],
        total: 21,
      },
    ];

    await onExecutePostLogin(
      {
        user: {
          email_verified: true,
          app_metadata: { orders },
          identities: [{ provider: "google-oauth2" }],
        },
      },
      api,
    );

    expect(api.idToken.setCustomClaim).toHaveBeenCalledWith(
      "https://pizza42.com/orders",
      orders,
    );
    expect(api.idToken.setCustomClaim).toHaveBeenCalledWith(
      "https://pizza42.com/customer_profile",
      {
        customer_segment: "Returning Regular",
        order_count: 4,
        favourite_item: "Margherita",
        favourite_store: "Dublin Camden Street",
        last_item_ordered: "Margherita",
        last_order_at: "2026-08-04T18:00:00.000Z",
        average_order_value: 14.5,
        identity_provider: "google-oauth2",
      },
    );
    expect(api.accessToken.setCustomClaim).toHaveBeenCalledTimes(1);
  });

  it.each([
    [1, "Occasional"],
    [10, "Loyal Regular"],
  ])(
    "uses the documented segment threshold for %i orders",
    async (count, segment) => {
      const api = createApi();
      const orders = Array.from({ length: count }, (_, index) => ({
        id: `ord_${index}`,
        placed_at: `2026-08-${String(index + 1).padStart(2, "0")}T18:00:00.000Z`,
        store: "Dublin Camden Street",
        items: [],
        total: 10,
      }));

      await onExecutePostLogin(
        {
          user: {
            email_verified: true,
            app_metadata: { orders },
            identities: [],
          },
        },
        api,
      );

      expect(api.idToken.setCustomClaim).toHaveBeenCalledWith(
        "https://pizza42.com/customer_profile",
        expect.objectContaining({ customer_segment: segment }),
      );
    },
  );
});
