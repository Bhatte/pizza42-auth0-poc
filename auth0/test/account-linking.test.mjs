import { createRequire } from "node:module";

import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { onExecutePostLogin, __internal } = require("../actions/post-login.js");
const { linkPreflight, linkDecision, mergeOrders } = __internal;

const EMAIL = "maya@example.com";

function order(id, placedAt, total = 20) {
  return {
    id,
    placed_at: placedAt,
    store: "Dublin Camden Street",
    items: [{ sku: "PIZ-MARG-L", name: "Margherita", qty: 1, size: "L" }],
    total,
    currency: "EUR",
  };
}

function googleUser(overrides = {}) {
  return {
    user_id: "google-oauth2|113742059188212345678",
    email: EMAIL,
    email_verified: true,
    app_metadata: {},
    identities: [{ provider: "google-oauth2" }],
    ...overrides,
  };
}

function databaseUser(overrides = {}) {
  return {
    user_id: "auth0|68a1f0c2d4e5f60012345678",
    email: EMAIL,
    email_verified: true,
    app_metadata: { orders: [order("ord_1", "2026-08-01T12:00:00.000Z")] },
    identities: [{ provider: "auth0" }],
    ...overrides,
  };
}

function createApi() {
  return {
    idToken: { setCustomClaim: vi.fn() },
    accessToken: { setCustomClaim: vi.fn() },
    authentication: { setPrimaryUser: vi.fn() },
  };
}

function createManagement(candidates) {
  return {
    findByEmail: vi.fn().mockResolvedValue(candidates),
    setOrders: vi.fn().mockResolvedValue({}),
    linkIdentity: vi.fn().mockResolvedValue({}),
  };
}

function claim(api, name) {
  const call = api.idToken.setCustomClaim.mock.calls.find(
    ([key]) => key === `https://pizza42.com/${name}`,
  );
  return call?.[1];
}

describe("who is even eligible to be linked", () => {
  it("does not search on a refresh-token exchange", () => {
    // The post-login trigger runs on every silent refresh the SPA makes. A
    // Management API call here would be two round trips on each of them.
    const result = linkPreflight({
      user: googleUser(),
      transaction: { protocol: "oauth2-refresh-token" },
    });

    expect(result).toEqual({ search: false, reason: "refresh_exchange" });
  });

  it("does not search for an identity whose own email is unverified", () => {
    const result = linkPreflight({
      user: googleUser({ email_verified: false }),
    });

    expect(result).toEqual({ search: false, reason: "email_unverified" });
  });

  it("does not search without an email address to search on", () => {
    const result = linkPreflight({ user: googleUser({ email: undefined }) });

    expect(result).toEqual({ search: false, reason: "no_email" });
  });

  it("does not offer a primary as somebody else's secondary", () => {
    const result = linkPreflight({
      user: googleUser({
        identities: [{ provider: "google-oauth2" }, { provider: "auth0" }],
      }),
    });

    expect(result).toEqual({ search: false, reason: "already_a_primary" });
  });

  it("searches for a verified single identity", () => {
    expect(linkPreflight({ user: googleUser() })).toEqual({
      search: true,
      reason: "eligible",
    });
  });
});

describe("choosing whether two accounts are one person", () => {
  // The attack this exists to refuse: register the victim's address on the
  // database connection, never open the verification mail, wait for them to
  // arrive through Google, and inherit their account.
  it("refuses a candidate that never verified its email", () => {
    const candidates = [databaseUser({ email_verified: false })];

    expect(linkDecision(googleUser(), candidates)).toEqual({
      link: false,
      reason: "no_match",
    });
  });

  it("refuses when more than one verified account claims the address", () => {
    const candidates = [
      databaseUser(),
      databaseUser({ user_id: "auth0|other" }),
    ];

    expect(linkDecision(googleUser(), candidates)).toEqual({
      link: false,
      reason: "ambiguous",
    });
  });

  it("never treats the caller as its own match", () => {
    expect(linkDecision(googleUser(), [googleUser()])).toEqual({
      link: false,
      reason: "no_match",
    });
  });

  it("refuses an address that only looks the same", () => {
    const candidates = [databaseUser({ email: "maya@example.com.co" })];

    expect(linkDecision(googleUser(), candidates)).toEqual({
      link: false,
      reason: "no_match",
    });
  });

  it("matches the same address written in a different case", () => {
    const candidates = [databaseUser({ email: "Maya@Example.com" })];

    expect(linkDecision(googleUser(), candidates).link).toBe(true);
  });

  it("accepts exactly one verified account on the same address", () => {
    const decision = linkDecision(googleUser(), [databaseUser()]);

    expect(decision.link).toBe(true);
    expect(decision.primary.user_id).toBe("auth0|68a1f0c2d4e5f60012345678");
  });
});

describe("carrying the orders across", () => {
  it("keeps both sides, oldest first", () => {
    const merged = mergeOrders(
      [order("ord_2", "2026-08-02T12:00:00.000Z")],
      [order("ord_1", "2026-08-01T12:00:00.000Z")],
    );

    expect(merged.map((entry) => entry.id)).toEqual(["ord_1", "ord_2"]);
  });

  it("does not duplicate an order that is already on both", () => {
    const shared = order("ord_1", "2026-08-01T12:00:00.000Z");

    expect(mergeOrders([shared], [shared])).toHaveLength(1);
  });

  it("copes with an account that has never ordered", () => {
    expect(mergeOrders([], [])).toEqual([]);
  });
});

describe("linking through the trigger", () => {
  it("links the new identity into the existing account and continues as it", async () => {
    const api = createApi();
    const management = createManagement([databaseUser()]);

    await onExecutePostLogin({ user: googleUser() }, api, { management });

    expect(management.linkIdentity).toHaveBeenCalledWith(
      "auth0|68a1f0c2d4e5f60012345678",
      { provider: "google-oauth2", userId: "113742059188212345678" },
    );
    expect(api.authentication.setPrimaryUser).toHaveBeenCalledWith(
      "auth0|68a1f0c2d4e5f60012345678",
    );
  });

  it("issues claims describing the account kept, not the identity used", async () => {
    const api = createApi();
    const management = createManagement([databaseUser()]);

    await onExecutePostLogin({ user: googleUser() }, api, { management });

    // The Google identity brought no orders. The claims must describe the
    // database account it was absorbed into, which has one.
    expect(claim(api, "orders")).toHaveLength(1);
    expect(claim(api, "customer_profile").order_count).toBe(1);
    expect(claim(api, "identities")).toEqual(["auth0", "google-oauth2"]);
  });

  it("moves the orders before the link destroys the record holding them", async () => {
    const api = createApi();
    const primary = databaseUser();
    const management = createManagement([primary]);
    const calls = [];
    management.setOrders.mockImplementation(async () => calls.push("orders"));
    management.linkIdentity.mockImplementation(async () => calls.push("link"));

    await onExecutePostLogin(
      {
        user: googleUser({
          app_metadata: {
            orders: [order("ord_9", "2026-08-09T12:00:00.000Z")],
          },
        }),
      },
      api,
      { management },
    );

    expect(calls).toEqual(["orders", "link"]);
    expect(management.setOrders).toHaveBeenCalledWith(
      "auth0|68a1f0c2d4e5f60012345678",
      [
        expect.objectContaining({ id: "ord_1" }),
        expect.objectContaining({ id: "ord_9" }),
      ],
    );
    expect(claim(api, "orders")).toHaveLength(2);
  });

  it("writes nothing when the existing account already holds every order", async () => {
    const api = createApi();
    const management = createManagement([databaseUser()]);

    await onExecutePostLogin({ user: googleUser() }, api, { management });

    expect(management.setOrders).not.toHaveBeenCalled();
    expect(management.linkIdentity).toHaveBeenCalled();
  });

  it("leaves the accounts separate when the other one is unverified", async () => {
    const api = createApi();
    const management = createManagement([
      databaseUser({ email_verified: false }),
    ]);

    await onExecutePostLogin({ user: googleUser() }, api, { management });

    expect(management.linkIdentity).not.toHaveBeenCalled();
    expect(api.authentication.setPrimaryUser).not.toHaveBeenCalled();
    expect(claim(api, "identities")).toEqual(["google-oauth2"]);
  });

  it("makes no Management API call at all on a refresh exchange", async () => {
    const api = createApi();
    const management = createManagement([databaseUser()]);

    await onExecutePostLogin(
      { user: googleUser(), transaction: { protocol: "oauth2-refresh-token" } },
      api,
      { management },
    );

    expect(management.findByEmail).not.toHaveBeenCalled();
  });

  // Two accounts is a worse experience than one. A failed sign-in is worse
  // than both.
  it("still signs the customer in when the Management API is unreachable", async () => {
    const api = createApi();
    const management = createManagement([]);
    management.findByEmail.mockRejectedValue(new Error("connect ETIMEDOUT"));

    await onExecutePostLogin({ user: databaseUser() }, api, { management });

    expect(claim(api, "orders")).toHaveLength(1);
    expect(api.accessToken.setCustomClaim).toHaveBeenCalledWith(
      "https://pizza42.com/email_verified",
      true,
    );
  });

  it("does not link at all in a tenant that has not configured it", async () => {
    const api = createApi();

    await onExecutePostLogin({ user: googleUser(), secrets: {} }, api);

    expect(api.authentication.setPrimaryUser).not.toHaveBeenCalled();
    expect(claim(api, "identities")).toEqual(["google-oauth2"]);
  });
});

describe("talking to the Management API", () => {
  const SECRETS = {
    MGMT_DOMAIN: "tenant.eu.auth0.com",
    MGMT_CLIENT_ID: "action-client-id",
    MGMT_CLIENT_SECRET: "action-client-secret",
  };

  function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  function createFetch(candidates = [databaseUser()]) {
    return vi.fn(async (url) => {
      if (url.endsWith("/oauth/token")) {
        return json({ access_token: "mgmt-token", expires_in: 86400 });
      }
      if (url.includes("/users-by-email")) return json(candidates);
      return json({});
    });
  }

  it("authenticates once and reuses the token for the rest of the login", async () => {
    const api = createApi();
    const fetchRequest = createFetch();

    await onExecutePostLogin(
      {
        user: googleUser({
          app_metadata: {
            orders: [order("ord_9", "2026-08-09T12:00:00.000Z")],
          },
        }),
        secrets: SECRETS,
      },
      api,
      { fetch: fetchRequest },
    );

    const urls = fetchRequest.mock.calls.map(([url]) => url);
    expect(urls.filter((url) => url.endsWith("/oauth/token"))).toHaveLength(1);
    // Search, then move the orders, then link.
    expect(urls).toHaveLength(4);
    expect(api.authentication.setPrimaryUser).toHaveBeenCalled();
  });

  it("addresses the link to the primary and names the secondary identity", async () => {
    const api = createApi();
    const fetchRequest = createFetch();

    await onExecutePostLogin({ user: googleUser(), secrets: SECRETS }, api, {
      fetch: fetchRequest,
    });

    const [url, init] = fetchRequest.mock.calls.find(([candidate]) =>
      candidate.endsWith("/identities"),
    );
    expect(url).toBe(
      "https://tenant.eu.auth0.com/api/v2/users/auth0%7C68a1f0c2d4e5f60012345678/identities",
    );
    expect(init.headers.authorization).toBe("Bearer mgmt-token");
    expect(JSON.parse(init.body)).toEqual({
      provider: "google-oauth2",
      user_id: "113742059188212345678",
    });
  });

  // The Action's client secret is a credential for changing identities. It
  // belongs in exactly one request and nowhere else.
  it("sends the client secret only to the token endpoint", async () => {
    const fetchRequest = createFetch();

    await onExecutePostLogin(
      { user: googleUser(), secrets: SECRETS },
      createApi(),
      { fetch: fetchRequest },
    );

    for (const [url, init] of fetchRequest.mock.calls) {
      if (url.endsWith("/oauth/token")) continue;
      expect(JSON.stringify(init ?? {})).not.toContain(
        SECRETS.MGMT_CLIENT_SECRET,
      );
    }
  });

  it("signs the customer in when the tenant refuses the Action's credentials", async () => {
    const api = createApi();
    const fetchRequest = vi.fn(async () => json({}, 401));

    await onExecutePostLogin({ user: googleUser(), secrets: SECRETS }, api, {
      fetch: fetchRequest,
    });

    expect(api.authentication.setPrimaryUser).not.toHaveBeenCalled();
    expect(claim(api, "identities")).toEqual(["google-oauth2"]);
  });

  it("gives up on a rate-limited search rather than pushing it into the login", async () => {
    const api = createApi();
    const fetchRequest = vi.fn(async (url) =>
      url.endsWith("/oauth/token")
        ? json({ access_token: "mgmt-token", expires_in: 86400 })
        : json({ error: "too_many_requests" }, 429),
    );

    await onExecutePostLogin({ user: googleUser(), secrets: SECRETS }, api, {
      fetch: fetchRequest,
    });

    expect(api.authentication.setPrimaryUser).not.toHaveBeenCalled();
    expect(claim(api, "orders")).toEqual([]);
  });
});
