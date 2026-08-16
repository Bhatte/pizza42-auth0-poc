import { describe, expect, it, vi } from "vitest";

import { createManagementOrdersRepository } from "../src/services/management.js";

const config = {
  domain: "pizza42-tests.eu.auth0.com",
  clientId: "orders-service-client",
  clientSecret: "test-secret-never-log",
  audience: "https://pizza42-tests.eu.auth0.com/api/v2/",
};

describe("Auth0 Management API orders repository", () => {
  it("reads the authenticated customer orders using an encoded user ID", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "management-token",
            expires_in: 3600,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user_id: "auth0|customer-42",
            app_metadata: { orders: [{ id: "ord_42" }] },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    const repository = createManagementOrdersRepository({ config, fetch });

    const orders = await repository.listForUser("auth0|customer-42");

    expect(orders).toEqual([{ id: "ord_42" }]);
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://pizza42-tests.eu.auth0.com/api/v2/users/auth0%7Ccustomer-42",
      expect.objectContaining({
        headers: { authorization: "Bearer management-token" },
      }),
    );
  });

  it("appends an order with one cached Management API token", async () => {
    const existingOrder = { id: "ord_existing" };
    const newOrder = { id: "ord_new" };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "management-token",
            expires_in: 3600,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ app_metadata: { orders: [existingOrder] } }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ app_metadata: {} }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    const repository = createManagementOrdersRepository({ config, fetch });

    await repository.appendForUser("auth0|customer-42", newOrder);

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "https://pizza42-tests.eu.auth0.com/api/v2/users/auth0%7Ccustomer-42",
      {
        method: "PATCH",
        headers: {
          authorization: "Bearer management-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          app_metadata: { orders: [existingOrder, newOrder] },
        }),
      },
    );
  });
});
