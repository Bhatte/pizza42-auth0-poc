import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Pizza42App } from "../src/Pizza42App.jsx";
import { createRequestLog } from "../src/lib/request-log.js";

function createGuestAuth() {
  return {
    isAuthenticated: false,
    isLoading: false,
    loginWithRedirect: vi.fn(),
  };
}

function createAuthenticatedAuth(overrides = {}) {
  return {
    isAuthenticated: true,
    isLoading: false,
    user: { name: "Maya", email: "maya@example.com" },
    idTokenClaims: {
      sub: "auth0|customer-42",
      "https://pizza42.com/email_verified": true,
      "https://pizza42.com/orders": [],
    },
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn().mockResolvedValue("access-token"),
    // Not real JWTs. The drawer falls back to the SDK's decoded claims when a
    // token will not decode, which is exactly the path these tests render.
    getRawTokens: vi
      .fn()
      .mockResolvedValue({ accessToken: "access-token", idToken: "id-token" }),
    refreshVerification: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function createApi() {
  return {
    getMenu: vi.fn().mockResolvedValue({
      currency: "EUR",
      stores: ["Dublin Camden Street", "Dublin Rathmines"],
      items: [
        {
          sku: "PIZ-MARG-L",
          name: "Margherita",
          description: "Tomato, mozzarella and basil",
          size: "Large",
          price: 14.5,
          category: "pizza",
        },
      ],
    }),
    getOrders: vi.fn().mockResolvedValue([]),
    createOrder: vi.fn().mockResolvedValue({
      id: "ord_confirmed",
      total: 14.5,
      currency: "EUR",
    }),
    identifyCustomer: vi.fn().mockResolvedValue({
      type: "identify",
      userId: "auth0|customer-42",
      traits: { customer_segment: "New Customer" },
    }),
    baseUrl: "https://api.pizza42.example",
    request: vi.fn(),
    log: createRequestLog(),
    getMeta: vi.fn().mockResolvedValue({
      service: "Pizza 42 Orders API",
      issuer: "https://tenant.eu.auth0.com/",
      audience: "https://api.pizza42.com",
      token_signing_alg: "RS256",
      required_scopes: { "POST /api/orders": ["create:orders"] },
      claim_namespace: "https://pizza42.com/",
      verified_email_claim: "https://pizza42.com/email_verified",
      verified_email_enforced_on: ["POST /api/orders"],
      currency: "EUR",
      max_line_quantity: 20,
      max_order_lines: 20,
    }),
  };
}

async function openDrawer(user, tab) {
  await user.click(screen.getByRole("button", { name: "Behind the counter" }));
  if (tab) await user.click(screen.getByRole("tab", { name: tab }));
}

describe("Pizza 42 ordering experience", () => {
  it("sells pizza to a guest and routes them to Universal Login", async () => {
    const user = userEvent.setup();
    const auth = createGuestAuth();

    render(<Pizza42App auth={auth} api={createApi()} />);

    expect(
      screen.getByRole("heading", { name: /forty-two seconds/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start your order" }));

    expect(auth.loginWithRedirect).toHaveBeenCalledOnce();
  });

  it("shows a guest the real menu before they sign in", async () => {
    const api = createApi();

    render(<Pizza42App auth={createGuestAuth()} api={api} />);

    expect(await screen.findByText("Margherita")).toBeInTheDocument();
    expect(screen.getByText("€14.50")).toBeInTheDocument();
    expect(api.getMenu).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "Add Margherita" }),
    ).not.toBeInTheDocument();
  });

  it("keeps identity vocabulary out of the customer journey", async () => {
    const { container } = render(
      <Pizza42App auth={createGuestAuth()} api={createApi()} />,
    );

    await screen.findByText("Margherita");

    // The colophon carries one deliberate, quiet build credit. Everything a
    // hungry customer actually reads should be about pizza.
    container.querySelector(".colophon").remove();
    const customerCopy = container.textContent;

    for (const jargon of [
      "Auth0",
      "password",
      "token",
      "identity",
      "secured",
      "API",
    ]) {
      expect(customerCopy.toLowerCase()).not.toContain(jargon.toLowerCase());
    }
  });

  it("lets an authenticated customer add an API menu item to the basket", async () => {
    const user = userEvent.setup();
    const auth = createAuthenticatedAuth();
    const api = createApi();

    render(<Pizza42App auth={auth} api={api} />);

    await user.click(
      await screen.findByRole("button", { name: "Add Margherita" }),
    );

    expect(screen.getByText("1 item")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /place order.*€14\.50/i }),
    ).toBeEnabled();
  });

  it("explains how an unverified customer can confirm their email", async () => {
    const user = userEvent.setup();
    const auth = createAuthenticatedAuth({
      idTokenClaims: {
        sub: "auth0|customer-42",
        "https://pizza42.com/email_verified": false,
        "https://pizza42.com/orders": [],
      },
    });

    render(<Pizza42App auth={auth} api={createApi()} />);

    const notice = screen
      .getByRole("heading", { name: "One step before your first order" })
      .closest("section");
    expect(notice).toHaveTextContent(/maya@example\.com/);

    await user.click(screen.getByRole("button", { name: "I've confirmed it" }));

    expect(auth.refreshVerification).toHaveBeenCalledOnce();
    expect(
      screen.getByText("Email confirmed. You can place your order."),
    ).toBeInTheDocument();
  });

  it.each([
    [
      "the refresh fails",
      { refreshVerification: vi.fn().mockRejectedValue(new Error("network")) },
      /could not check your account/i,
    ],
    [
      "the address is still unconfirmed",
      { refreshVerification: vi.fn().mockResolvedValue(false) },
      /not seeing it yet/i,
    ],
  ])(
    "tells the customer what happened when %s",
    async (_case, authOverrides, expected) => {
      const user = userEvent.setup();
      const auth = createAuthenticatedAuth({
        idTokenClaims: {
          sub: "auth0|customer-42",
          "https://pizza42.com/email_verified": false,
          "https://pizza42.com/orders": [],
        },
        ...authOverrides,
      });

      render(<Pizza42App auth={auth} api={createApi()} />);

      const check = screen.getByRole("button", { name: "I've confirmed it" });
      await user.click(check);

      expect(await screen.findByText(expected)).toBeInTheDocument();
      // The button has to come back, or the customer is stranded on "Checking…".
      expect(check).toBeEnabled();
    },
  );

  // The API rejects a line over 20. Discovering that after pressing "Place
  // order" is a preventable dead end, so the basket refuses to build one.
  it("stops the basket at the quantity the API will accept", async () => {
    const user = userEvent.setup();

    render(<Pizza42App auth={createAuthenticatedAuth()} api={createApi()} />);

    await user.click(
      await screen.findByRole("button", { name: "Add Margherita" }),
    );

    const addAnother = screen.getByRole("button", {
      name: "Add another Margherita",
    });
    for (let click = 0; click < 25; click += 1) {
      if (!addAnother.disabled) await user.click(addAnother);
    }

    expect(screen.getByLabelText("Margherita quantity")).toHaveTextContent(
      "20",
    );
    expect(addAnother).toBeDisabled();
    expect(screen.getByText("Maximum 20 per item")).toBeInTheDocument();
  });

  it("submits only SKU and quantity, then confirms the authoritative order", async () => {
    const user = userEvent.setup();
    const auth = createAuthenticatedAuth();
    const api = createApi();

    render(<Pizza42App auth={auth} api={api} />);

    await user.click(
      await screen.findByRole("button", { name: "Add Margherita" }),
    );
    await user.click(
      screen.getByRole("button", { name: /place order.*€14\.50/i }),
    );

    expect(api.createOrder).toHaveBeenCalledWith(
      {
        store: "Dublin Camden Street",
        items: [{ sku: "PIZ-MARG-L", qty: 1 }],
      },
      "access-token",
    );
    expect(
      await screen.findByText("Order ord_confirmed is with the kitchen."),
    ).toBeInTheDocument();
    expect(screen.getByText("0 items")).toBeInTheDocument();
  });

  it("sends the store the customer selected, not a hardcoded one", async () => {
    const user = userEvent.setup();
    const auth = createAuthenticatedAuth();
    const api = createApi();

    render(<Pizza42App auth={auth} api={api} />);

    await user.selectOptions(
      await screen.findByLabelText("Collecting from"),
      "Dublin Rathmines",
    );
    await user.click(screen.getByRole("button", { name: "Add Margherita" }));
    await user.click(screen.getByRole("button", { name: /place order/i }));

    expect(api.createOrder).toHaveBeenCalledWith(
      {
        store: "Dublin Rathmines",
        items: [{ sku: "PIZ-MARG-L", qty: 1 }],
      },
      "access-token",
    );
  });

  it("turns an API verification failure into an inline recovery path", async () => {
    const user = userEvent.setup();
    const auth = createAuthenticatedAuth();
    const api = createApi();
    api.createOrder.mockRejectedValue({
      code: "email_not_verified",
      message: "We just need to confirm your email before your first order.",
    });

    render(<Pizza42App auth={auth} api={api} />);

    await user.click(
      await screen.findByRole("button", { name: "Add Margherita" }),
    );
    await user.click(
      screen.getByRole("button", { name: /place order.*€14\.50/i }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "One step before your first order",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "We just need to confirm your email before your first order.",
      ),
    ).toBeInTheDocument();
  });

  it("renders order history as plain customer context", async () => {
    const api = createApi();
    api.getOrders.mockResolvedValue([
      {
        id: "ord_history",
        placed_at: "2026-08-09T18:22:00.000Z",
        store: "Dublin Camden Street",
        total: 21.4,
        currency: "EUR",
      },
    ]);

    render(<Pizza42App auth={createAuthenticatedAuth()} api={api} />);

    expect(
      screen.getByRole("heading", { name: "Recent orders" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("ord_history")).toBeInTheDocument();
    expect(screen.getByText("€21.40")).toBeInTheDocument();
  });

  // The bug this replaces: history came from the ID token, which is minted at
  // login and cannot contain an order placed a second ago. A customer saw
  // "Order ord_confirmed is with the kitchen" above "Nothing yet".
  it("shows a newly placed order in history without a new sign-in", async () => {
    const user = userEvent.setup();
    const api = createApi();
    api.getOrders.mockResolvedValueOnce([]).mockResolvedValue([
      {
        id: "ord_confirmed",
        placed_at: "2026-08-18T18:22:00.000Z",
        store: "Dublin Camden Street",
        total: 14.5,
        currency: "EUR",
      },
    ]);

    render(<Pizza42App auth={createAuthenticatedAuth()} api={api} />);

    expect(await screen.findByText(/nothing yet/i)).toBeInTheDocument();

    await user.click(
      await screen.findByRole("button", { name: "Add Margherita" }),
    );
    await user.click(screen.getByRole("button", { name: /place order/i }));

    expect(await screen.findByText("ord_confirmed")).toBeInTheDocument();
    expect(screen.queryByText(/nothing yet/i)).not.toBeInTheDocument();
  });

  it("keeps the order confirmation honest when history cannot be read", async () => {
    const user = userEvent.setup();
    const api = createApi();
    api.getOrders.mockRejectedValue(new Error("history unavailable"));

    render(<Pizza42App auth={createAuthenticatedAuth()} api={api} />);

    await user.click(
      await screen.findByRole("button", { name: "Add Margherita" }),
    );
    await user.click(screen.getByRole("button", { name: /place order/i }));

    expect(await screen.findByText(/is with the kitchen/i)).toBeInTheDocument();
    expect(
      screen.getByText(/could not load your recent orders/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/nothing yet/i)).not.toBeInTheDocument();
  });

  it("keeps identity evidence out of the ordering view until it is asked for", async () => {
    const user = userEvent.setup();

    render(<Pizza42App auth={createAuthenticatedAuth()} api={createApi()} />);

    expect(
      screen.queryByRole("complementary", { name: "Behind the counter" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("auth0|customer-42")).not.toBeInTheDocument();

    await openDrawer(user);

    expect(
      screen.getByRole("complementary", { name: "Behind the counter" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("auth0|customer-42")).toBeInTheDocument();
  });

  it("opens and closes the evidence panel from the keyboard", async () => {
    const user = userEvent.setup();

    render(<Pizza42App auth={createAuthenticatedAuth()} api={createApi()} />);

    await user.keyboard("?");
    expect(
      screen.getByRole("complementary", { name: "Behind the counter" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("complementary", { name: "Behind the counter" }),
    ).not.toBeInTheDocument();
  });

  it("compares the token audience against the audience the API enforces", async () => {
    const user = userEvent.setup();

    render(<Pizza42App auth={createAuthenticatedAuth()} api={createApi()} />);

    await openDrawer(user);

    // There is no real JWT in this test, so the token side is unreadable. The
    // panel must report that honestly rather than claim a match it cannot see.
    expect(
      await screen.findByText(/audience does not agree/i),
    ).toBeInTheDocument();
    expect(screen.getByText("RS256")).toBeInTheDocument();
  });

  it("runs a probe against the API and reports what actually came back", async () => {
    const user = userEvent.setup();
    const api = createApi();
    api.request.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "authentication_required",
          message: "A valid access token is required.",
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    );

    render(<Pizza42App auth={createAuthenticatedAuth()} api={api} />);

    await openDrawer(user, "Prove it");
    // Probes stay disabled until the session has been read, which is the state
    // the panel reports as "Reading session…".
    const [firstProbe] = await screen.findAllByRole("button", { name: "Run" });
    await waitFor(() => expect(firstProbe).toBeEnabled());
    await user.click(firstProbe);

    expect(await screen.findByText("As expected")).toBeInTheDocument();
    expect(api.request).toHaveBeenCalledWith(
      "https://api.pizza42.example/api/orders",
      expect.objectContaining({ method: "GET", headers: {} }),
    );
  });

  it("surfaces the marketing traits the customer briefing asked for", async () => {
    const user = userEvent.setup();
    const api = createApi();
    api.identifyCustomer.mockResolvedValue({
      type: "identify",
      userId: "auth0|customer-42",
      traits: {
        favourite_store: "Dublin Camden Street",
        last_item_ordered: "Margherita",
      },
    });

    render(<Pizza42App auth={createAuthenticatedAuth()} api={api} />);

    await openDrawer(user, "Insight");

    // Each trait appears twice on this tab: once in the summary grid, and once
    // in the row comparing the signed claim against the live profile.
    expect((await screen.findAllByText("Favourite store")).length).toBe(2);
    expect(screen.getAllByText("Last item ordered").length).toBe(2);
    expect(screen.getAllByText("Dublin Camden Street").length).toBeGreaterThan(
      0,
    );

    const payload = screen.getByLabelText("Simulated marketing payload");
    expect(payload.textContent).toContain("favourite_store");
    expect(payload.textContent).toContain("last_item_ordered");
  });

  it("keeps ordering available when the optional marketing simulation fails", async () => {
    const user = userEvent.setup();
    const api = createApi();
    api.identifyCustomer.mockRejectedValue(
      new Error("destination unavailable"),
    );

    render(<Pizza42App auth={createAuthenticatedAuth()} api={api} />);

    await user.click(
      await screen.findByRole("button", { name: "Add Margherita" }),
    );

    expect(
      screen.getByRole("button", { name: /place order.*€14\.50/i }),
    ).toBeEnabled();

    await openDrawer(user, "Insight");
    expect(
      await screen.findByText(/destination did not answer/i),
    ).toBeInTheDocument();
  });
});
