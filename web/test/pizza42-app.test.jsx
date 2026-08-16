import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Pizza42App } from "../src/Pizza42App.jsx";

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
  };
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
      .getByRole("heading", { name: "Confirm your email to order" })
      .closest("section");
    expect(notice).toHaveTextContent(/maya@example\.com/);

    await user.click(screen.getByRole("button", { name: "I've confirmed it" }));

    expect(auth.refreshVerification).toHaveBeenCalledOnce();
    expect(
      screen.getByText("Email confirmed. You can place your order."),
    ).toBeInTheDocument();
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
      message: "A verified email address is required before placing an order.",
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
        name: "Confirm your email to order",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "A verified email address is required before placing an order.",
      ),
    ).toBeInTheDocument();
  });

  it("renders order history as plain customer context", async () => {
    const auth = createAuthenticatedAuth({
      idTokenClaims: {
        sub: "auth0|customer-42",
        "https://pizza42.com/email_verified": true,
        "https://pizza42.com/orders": [
          {
            id: "ord_history",
            placed_at: "2026-08-09T18:22:00.000Z",
            store: "Dublin Camden Street",
            total: 21.4,
            currency: "EUR",
          },
        ],
      },
    });

    render(<Pizza42App auth={auth} api={createApi()} />);

    expect(
      screen.getByRole("heading", { name: "Recent orders" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ord_history")).toBeInTheDocument();
    expect(screen.getByText("€21.40")).toBeInTheDocument();
  });

  it("keeps identity detail behind a quiet, collapsed disclosure", async () => {
    const user = userEvent.setup();
    const auth = createAuthenticatedAuth({
      idTokenClaims: {
        sub: "auth0|customer-42",
        "https://pizza42.com/email_verified": true,
        "https://pizza42.com/orders": [],
        "https://pizza42.com/customer_profile": {
          customer_segment: "Returning Regular",
          favourite_store: "Dublin Camden Street",
          last_item_ordered: "Margherita",
        },
      },
    });

    render(<Pizza42App auth={auth} api={createApi()} />);

    const summary = screen.getByText("Session details");
    expect(summary.closest("details")).not.toHaveAttribute("open");

    await user.click(summary);

    expect(summary.closest("details")).toHaveAttribute("open");
    expect(screen.getByText("auth0|customer-42")).toBeInTheDocument();
    expect(screen.queryByText("access-token")).not.toBeInTheDocument();
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

    await user.click(await screen.findByText("Session details"));

    const profile = await screen.findByLabelText("Derived customer profile");
    expect(profile.textContent).toContain("favourite_store");
    expect(profile.textContent).toContain("last_item_ordered");
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

    await user.click(screen.getByText("Session details"));
    expect(
      await screen.findByText(/destination unavailable\. ordering is/i),
    ).toBeInTheDocument();
  });
});
