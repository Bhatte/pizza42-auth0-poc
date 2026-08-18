import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { createTestIssuer } from "./helpers/test-issuer.js";

// Everything an order needs, so a rejection can only be about the one thing a
// test deliberately breaks.
const ORDER_READY_TOKEN = Object.freeze({
  scope: "create:orders",
  claims: { "https://pizza42.com/email_verified": true },
});

let authConfig;
let issuer;
// A second, fully valid issuer with its own key pair. Its tokens are correctly
// signed and structurally perfect; they are simply not from the issuer this API
// trusts. That is what makes it a real foreign-issuer test rather than a
// malformed-token test wearing the name.
let foreignIssuer;

beforeAll(async () => {
  issuer = await createTestIssuer();
  foreignIssuer = await createTestIssuer();
  authConfig = {
    audience: "https://api.pizza42.com",
    issuerBaseURL: issuer.issuer,
  };
});

afterAll(async () => {
  await Promise.all([issuer.close(), foreignIssuer.close()]);
});

describe("GET /api/health", () => {
  it("reports that the API is ready without exposing infrastructure details", async () => {
    const response = await request(createApp({ authConfig })).get(
      "/api/health",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.headers).toHaveProperty(
      "x-content-type-options",
      "nosniff",
    );
    expect(response.headers).toHaveProperty("ratelimit");
    expect(response.headers).not.toHaveProperty("x-powered-by");
  });

  it("returns CORS headers only for an explicitly allowed web origin", async () => {
    const app = createApp({
      authConfig,
      allowedOrigins: ["https://pizza42.example"],
    });

    const allowed = await request(app)
      .get("/api/health")
      .set("origin", "https://pizza42.example");
    const untrusted = await request(app)
      .get("/api/health")
      .set("origin", "https://attacker.example");

    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://pizza42.example",
    );
    expect(untrusted.headers).not.toHaveProperty("access-control-allow-origin");
  });
});

describe("GET /api/menu", () => {
  it("returns the server-owned catalogue and currency", async () => {
    const response = await request(createApp({ authConfig })).get("/api/menu");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      currency: "EUR",
      stores: ["Dublin Camden Street", "Dublin Rathmines", "Dublin Smithfield"],
      items: [
        {
          sku: "PIZ-MARG-L",
          name: "Margherita",
          description: "Tomato, mozzarella and basil",
          size: "Large",
          price: 14.5,
          category: "pizza",
        },
        {
          sku: "PIZ-VEG-L",
          name: "Garden Veg",
          description: "Roasted peppers, mushroom, red onion and mozzarella",
          size: "Large",
          price: 15.5,
          category: "pizza",
        },
        {
          sku: "SID-GARL",
          name: "Garlic Bread",
          description: "Baked with garlic butter and parsley",
          price: 4.5,
          category: "side",
        },
      ],
    });
  });
});

describe("POST /api/orders authorization", () => {
  it("rejects a request without an access token", async () => {
    const response = await request(createApp({ authConfig }))
      .post("/api/orders")
      .send({
        store: "Dublin Camden Street",
        items: [{ sku: "PIZ-MARG-L", qty: 1 }],
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "authentication_required",
      message: "A valid access token is required.",
    });
  });

  it("rejects a valid access token without the create:orders scope", async () => {
    const accessToken = await issuer.issueToken({ scope: "read:orders" });

    const response = await request(createApp({ authConfig }))
      .post("/api/orders")
      .set("authorization", `Bearer ${accessToken}`)
      .send({
        store: "Dublin Camden Street",
        items: [{ sku: "PIZ-MARG-L", qty: 1 }],
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "insufficient_scope",
      message: "The access token does not grant this operation.",
    });
    expect(response.headers["www-authenticate"]).toContain(
      'scope="create:orders"',
    );
  });

  // Each of these tokens would place an order if it were trusted: correct
  // scope, verified-email claim, valid signature. Only the issuing authority or
  // the validity window is wrong, which is the whole point.
  it.each([
    [
      "the wrong audience",
      () =>
        issuer.issueToken({
          ...ORDER_READY_TOKEN,
          audience: "https://another-api.example",
        }),
    ],
    [
      "an expired lifetime",
      () => issuer.issueToken({ ...ORDER_READY_TOKEN, expiresIn: "-1m" }),
    ],
    [
      "a foreign issuer's signature",
      () => foreignIssuer.issueToken(ORDER_READY_TOKEN),
    ],
  ])("rejects a signed token with %s", async (_scenario, issueToken) => {
    const accessToken = await issueToken();

    const response = await request(createApp({ authConfig }))
      .post("/api/orders")
      .set("authorization", `Bearer ${accessToken}`)
      .send({
        store: "Dublin Camden Street",
        items: [{ sku: "PIZ-MARG-L", qty: 1 }],
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "authentication_required",
      message: "A valid access token is required.",
    });
  });

  // The middleware tests `=== true`, so anything that is not the boolean is a
  // refusal. The string case matters most: `"false"` and `"true"` are both
  // truthy, so a claim that arrived as text would wave through an unverified
  // customer under a `Boolean(claim)` check.
  it.each([
    ["is false", { "https://pizza42.com/email_verified": false }],
    ["is absent entirely", {}],
    [
      'arrived as the string "true"',
      { "https://pizza42.com/email_verified": "true" },
    ],
  ])(
    "allows sign-in state but rejects ordering when the verification claim %s",
    async (_scenario, claims) => {
      const accessToken = await issuer.issueToken({
        scope: "create:orders",
        claims,
      });

      const response = await request(createApp({ authConfig }))
        .post("/api/orders")
        .set("authorization", `Bearer ${accessToken}`)
        .send({
          store: "Dublin Camden Street",
          items: [{ sku: "PIZ-MARG-L", qty: 1 }],
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: "email_not_verified",
        message:
          "A verified email address is required before placing an order.",
        remediation:
          "Check your inbox for the verification link, then refresh your session.",
      });
    },
  );
});

describe("POST /api/orders", () => {
  it("creates an authoritative order for a verified customer", async () => {
    const accessToken = await issuer.issueToken({
      scope: "create:orders",
      claims: { "https://pizza42.com/email_verified": true },
    });
    const ordersRepository = {
      appendForUser: async (_subject, order) => order,
    };

    const response = await request(createApp({ authConfig, ordersRepository }))
      .post("/api/orders")
      .set("authorization", `Bearer ${accessToken}`)
      .send({
        store: "Dublin Camden Street",
        items: [
          { sku: "PIZ-MARG-L", qty: 1 },
          { sku: "SID-GARL", qty: 2 },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      store: "Dublin Camden Street",
      items: [
        {
          sku: "PIZ-MARG-L",
          name: "Margherita",
          size: "Large",
          qty: 1,
          unit_price: 14.5,
          line_total: 14.5,
        },
        {
          sku: "SID-GARL",
          name: "Garlic Bread",
          qty: 2,
          unit_price: 4.5,
          line_total: 9,
        },
      ],
      total: 23.5,
      currency: "EUR",
    });
    expect(response.body.id).toMatch(/^ord_[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(response.body.placed_at))).toBe(false);
  });

  it("rejects an unknown SKU without exposing an internal exception", async () => {
    const accessToken = await issuer.issueToken({
      scope: "create:orders",
      claims: { "https://pizza42.com/email_verified": true },
    });
    const ordersRepository = {
      appendForUser: async (_subject, order) => order,
    };

    const response = await request(createApp({ authConfig, ordersRepository }))
      .post("/api/orders")
      .set("authorization", `Bearer ${accessToken}`)
      .send({
        store: "Dublin Camden Street",
        items: [{ sku: "PIZ-DOES-NOT-EXIST", qty: 1 }],
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "unknown_sku",
      message: "The requested menu item is not available.",
    });
    expect(JSON.stringify(response.body)).not.toContain("TypeError");
  });

  it("rejects client-supplied prices instead of treating them as authority", async () => {
    const accessToken = await issuer.issueToken({
      scope: "create:orders",
      claims: { "https://pizza42.com/email_verified": true },
    });
    const ordersRepository = {
      appendForUser: async (_subject, order) => order,
    };

    const response = await request(createApp({ authConfig, ordersRepository }))
      .post("/api/orders")
      .set("authorization", `Bearer ${accessToken}`)
      .send({
        store: "Dublin Camden Street",
        items: [{ sku: "PIZ-MARG-L", qty: 1, unit_price: 0.01 }],
        total: 0.01,
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "invalid_order",
      message: "One or more order items are invalid.",
    });
  });

  it.each([["__proto__"], ["constructor"], ["toString"], ["valueOf"]])(
    "rejects the inherited Object.prototype member %s as a SKU",
    async (sku) => {
      const accessToken = await issuer.issueToken({
        scope: "create:orders",
        claims: { "https://pizza42.com/email_verified": true },
      });
      const ordersRepository = {
        appendForUser: async (_subject, order) => order,
      };

      const response = await request(
        createApp({ authConfig, ordersRepository }),
      )
        .post("/api/orders")
        .set("authorization", `Bearer ${accessToken}`)
        .send({ store: "Dublin Camden Street", items: [{ sku, qty: 1 }] });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "unknown_sku",
        message: "The requested menu item is not available.",
      });
    },
  );

  it("never produces an order without an authoritative total", async () => {
    const accessToken = await issuer.issueToken({
      scope: "create:orders",
      claims: { "https://pizza42.com/email_verified": true },
    });
    const stored = [];
    const ordersRepository = {
      appendForUser: async (_subject, order) => {
        stored.push(order);
        return order;
      },
    };
    const app = createApp({ authConfig, ordersRepository });

    for (const sku of ["toString", "__proto__", "PIZ-MARG-L"]) {
      await request(app)
        .post("/api/orders")
        .set("authorization", `Bearer ${accessToken}`)
        .send({ store: "Dublin Camden Street", items: [{ sku, qty: 2 }] });
    }

    expect(stored).toHaveLength(1);
    expect(stored[0].total).toBe(29);
    expect(stored.every((order) => Number.isFinite(order.total))).toBe(true);
  });

  it("rejects quantities outside the bounded order contract", async () => {
    const accessToken = await issuer.issueToken({
      scope: "create:orders",
      claims: { "https://pizza42.com/email_verified": true },
    });

    const response = await request(createApp({ authConfig }))
      .post("/api/orders")
      .set("authorization", `Bearer ${accessToken}`)
      .send({
        store: "Dublin Camden Street",
        items: [{ sku: "PIZ-MARG-L", qty: 21 }],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid_order");
  });
});

describe("GET /api/orders", () => {
  it("returns only the authenticated customer order history", async () => {
    const accessToken = await issuer.issueToken({ scope: "read:orders" });
    const customerOrder = {
      id: "ord_customer",
      placed_at: "2026-08-15T18:00:00.000Z",
      store: "Dublin Camden Street",
      items: [],
      total: 14.5,
      currency: "EUR",
    };
    const histories = new Map([
      ["auth0|customer-42", [customerOrder]],
      ["auth0|another-customer", [{ ...customerOrder, id: "ord_private" }]],
    ]);
    const ordersRepository = {
      listForUser: async (subject) => histories.get(subject) ?? [],
    };

    const response = await request(createApp({ authConfig, ordersRepository }))
      .get("/api/orders")
      .set("authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ orders: [customerOrder] });
    expect(JSON.stringify(response.body)).not.toContain("ord_private");
  });
});

describe("marketing event simulation", () => {
  it("derives a Segment-shaped identify event from the authenticated customer", async () => {
    const accessToken = await issuer.issueToken({ scope: "read:orders" });
    const customerOrder = {
      id: "ord_customer",
      placed_at: "2026-08-15T18:00:00.000Z",
      store: "Dublin Camden Street",
      items: [{ name: "Margherita", qty: 1 }],
      total: 14.5,
      currency: "EUR",
    };
    const ordersRepository = {
      listForUser: async () => [customerOrder],
    };

    const response = await request(createApp({ authConfig, ordersRepository }))
      .post("/api/marketing/identify")
      .set("authorization", `Bearer ${accessToken}`)
      .send({ traits: { customer_segment: "VIP" } });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      accepted: true,
      event: {
        type: "identify",
        userId: "auth0|customer-42",
        traits: {
          customer_segment: "Occasional",
          order_count: 1,
          favourite_item: "Margherita",
          favourite_store: "Dublin Camden Street",
          identity_provider: "auth0",
        },
        context: { source: "pizza42-poc" },
      },
    });
    expect(response.body.event.traits).not.toHaveProperty("VIP");
    expect(response.body.event.timestamp).toMatch(/^2026-|^20\d\d-/);
  });

  it("returns only events belonging to the access-token subject", async () => {
    const customerToken = await issuer.issueToken({ scope: "read:orders" });
    const anotherToken = await issuer.issueToken({
      subject: "auth0|another-customer",
      scope: "read:orders",
    });
    const ordersRepository = { listForUser: async () => [] };
    const app = createApp({ authConfig, ordersRepository });

    await request(app)
      .post("/api/marketing/identify")
      .set("authorization", `Bearer ${customerToken}`);
    await request(app)
      .post("/api/marketing/identify")
      .set("authorization", `Bearer ${anotherToken}`);

    const response = await request(app)
      .get("/api/marketing/events")
      .set("authorization", `Bearer ${customerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.events).toHaveLength(1);
    expect(response.body.events[0].userId).toBe("auth0|customer-42");
    expect(JSON.stringify(response.body)).not.toContain("another-customer");
  });
});

describe("API error contracts", () => {
  it("returns safe JSON for malformed requests and unknown routes", async () => {
    const app = createApp({ authConfig });
    const malformed = await request(app)
      .post("/api/orders")
      .set("content-type", "application/json")
      .send("{not-json");
    const missing = await request(app).get("/api/does-not-exist");

    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({
      error: "invalid_json",
      message: "The request body must be valid JSON.",
    });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      error: "not_found",
      message: "The requested resource does not exist.",
    });
  });
});
