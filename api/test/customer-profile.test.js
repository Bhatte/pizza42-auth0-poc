import { describe, expect, it } from "vitest";

import { deriveCustomerProfile } from "../src/domain/customer-profile.js";

function createOrders(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `ord_${index + 1}`,
    placed_at: `2026-08-${String(index + 1).padStart(2, "0")}T18:00:00.000Z`,
    store: "Dublin Camden Street",
    items: [],
    total: 10,
  }));
}

describe("customer profile derivation", () => {
  it("represents a customer with no orders", () => {
    expect(deriveCustomerProfile([], { identityProvider: "auth0" })).toEqual({
      customer_segment: "New Customer",
      order_count: 0,
      favourite_item: null,
      favourite_store: null,
      last_item_ordered: null,
      last_order_at: null,
      average_order_value: 0,
      identity_provider: "auth0",
    });
  });

  it.each([
    [1, "Occasional"],
    [4, "Returning Regular"],
    [10, "Loyal Regular"],
  ])("segments %i orders as %s", (count, expectedSegment) => {
    expect(deriveCustomerProfile(createOrders(count)).customer_segment).toBe(
      expectedSegment,
    );
  });

  it("derives favourites, recency and average value", () => {
    const orders = [
      {
        id: "ord_1",
        placed_at: "2026-08-01T18:00:00.000Z",
        store: "Dublin Rathmines",
        items: [{ name: "Margherita", qty: 2 }],
        total: 20,
      },
      {
        id: "ord_2",
        placed_at: "2026-08-03T18:00:00.000Z",
        store: "Dublin Camden Street",
        items: [{ name: "Garlic bread", qty: 1 }],
        total: 10,
      },
      {
        id: "ord_3",
        placed_at: "2026-08-02T18:00:00.000Z",
        store: "Dublin Camden Street",
        items: [{ name: "Margherita", qty: 1 }],
        total: 15,
      },
    ];

    expect(
      deriveCustomerProfile(orders, { identityProvider: "google-oauth2" }),
    ).toEqual({
      customer_segment: "Occasional",
      order_count: 3,
      favourite_item: "Margherita",
      favourite_store: "Dublin Camden Street",
      last_item_ordered: "Garlic bread",
      last_order_at: "2026-08-03T18:00:00.000Z",
      average_order_value: 15,
      identity_provider: "google-oauth2",
    });
  });
});
