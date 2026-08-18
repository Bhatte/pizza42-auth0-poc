import { describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient } from "../src/lib/api.js";

describe("Pizza 42 API client", () => {
  it("sends an access token and the minimal order payload", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "ord_42" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    const api = createApiClient({
      baseUrl: "https://api.pizza42.example",
      fetch,
    });
    const order = {
      store: "Dublin Camden Street",
      items: [{ sku: "PIZ-MARG-L", qty: 1 }],
    };

    await api.createOrder(order, "customer-access-token");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.pizza42.example/api/orders",
      {
        method: "POST",
        headers: {
          authorization: "Bearer customer-access-token",
          "content-type": "application/json",
        },
        body: JSON.stringify(order),
      },
    );
  });

  it("reads order history with a bearer token and unwraps the collection", async () => {
    const orders = [
      { id: "ord_42", store: "Dublin Camden Street", total: 14.5 },
    ];
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ orders }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const api = createApiClient({
      baseUrl: "https://api.pizza42.example",
      fetch,
    });

    await expect(api.getOrders("customer-access-token")).resolves.toEqual(
      orders,
    );

    expect(fetch).toHaveBeenCalledWith(
      "https://api.pizza42.example/api/orders",
      { headers: { authorization: "Bearer customer-access-token" } },
    );
  });

  it("requests a server-derived marketing event without sending customer traits", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ accepted: true, event: { type: "identify" } }),
        {
          status: 202,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    const api = createApiClient({
      baseUrl: "https://api.pizza42.example/",
      fetch,
    });

    await api.identifyCustomer("customer-access-token");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.pizza42.example/api/marketing/identify",
      {
        method: "POST",
        headers: { authorization: "Bearer customer-access-token" },
      },
    );
  });

  it("loads the public menu without attaching an authorization header", async () => {
    const menu = { currency: "EUR", items: [] };
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(menu), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const api = createApiClient({
      baseUrl: "https://api.pizza42.example",
      fetch,
    });

    await expect(api.getMenu()).resolves.toEqual(menu);
    expect(fetch).toHaveBeenCalledWith("https://api.pizza42.example/api/menu");
  });

  it.each([
    [
      "a rate-limit page",
      429,
      "Too many requests, please try again later.",
      "text/html",
      "The kitchen is busy right now. Try again in a moment.",
    ],
    [
      "a gateway error page",
      502,
      "<html><body>502 Bad Gateway</body></html>",
      "text/html",
      "We could not reach the kitchen. Your basket has not been changed.",
    ],
    [
      "an empty body",
      500,
      "",
      "application/json",
      "Something went wrong on our side. Your basket has not been changed.",
    ],
  ])(
    "turns %s into a customer-readable error instead of a parse failure",
    async (_scenario, status, body, contentType, expectedMessage) => {
      const fetch = vi.fn().mockResolvedValue(
        new Response(body, {
          status,
          headers: { "content-type": contentType },
        }),
      );
      const api = createApiClient({
        baseUrl: "https://api.pizza42.example",
        fetch,
      });

      const error = await api
        .createOrder(
          {
            store: "Dublin Camden Street",
            items: [{ sku: "PIZ-MARG-L", qty: 1 }],
          },
          "access-token",
        )
        .catch((reason) => reason);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe(expectedMessage);
      expect(error.message).not.toMatch(/JSON/i);
      expect(error.status).toBe(status);
    },
  );

  it("preserves safe API remediation details in a typed error", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "email_not_verified",
          message: "Verify your email before ordering.",
          remediation: "Refresh your session.",
        }),
        {
          status: 403,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    const api = createApiClient({
      baseUrl: "https://api.pizza42.example",
      fetch,
    });

    const error = await api
      .createOrder({}, "access-token")
      .catch((reason) => reason);

    expect(error).toMatchObject({
      name: "ApiError",
      code: "email_not_verified",
      message: "Verify your email before ordering.",
      remediation: "Refresh your session.",
      status: 403,
    });
    expect(error).toBeInstanceOf(ApiError);
  });
});
