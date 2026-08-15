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
  it("gives a guest a direct path to Auth0 Universal Login", async () => {
    const user = userEvent.setup();
    const auth = createGuestAuth();

    render(<Pizza42App auth={auth} />);

    expect(
      screen.getByRole("heading", { name: /your friday night/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign in to order" }));

    expect(auth.loginWithRedirect).toHaveBeenCalledOnce();
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

  it("explains how an unverified customer can refresh their security state", async () => {
    const user = userEvent.setup();
    const auth = createAuthenticatedAuth({
      idTokenClaims: {
        "https://pizza42.com/email_verified": false,
        "https://pizza42.com/orders": [],
      },
    });

    render(<Pizza42App auth={auth} api={createApi()} />);

    expect(
      screen.getByRole("heading", { name: "Verify once, then order" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "I've verified my email" }),
    );

    expect(auth.refreshVerification).toHaveBeenCalledOnce();
    expect(
      screen.getByText("Email verified. You can place your order."),
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
      await screen.findByText("Order ord_confirmed is in."),
    ).toBeInTheDocument();
    expect(screen.getByText("0 items")).toBeInTheDocument();
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
      await screen.findByRole("heading", { name: "Verify once, then order" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "A verified email address is required before placing an order.",
      ),
    ).toBeInTheDocument();
  });

  it("renders order history from the ID token as read-only customer context", () => {
    const auth = createAuthenticatedAuth({
      idTokenClaims: {
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
      screen.getByRole("heading", { name: "Your recent orders" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ord_history")).toBeInTheDocument();
    expect(screen.getByText("€21.40")).toBeInTheDocument();
    expect(
      screen.getByText(/shown from your latest ID token/i),
    ).toBeInTheDocument();
  });

  it("keeps token and marketing evidence behind an explicit inspector", async () => {
    const user = userEvent.setup();
    const auth = createAuthenticatedAuth({
      idTokenClaims: {
        "https://pizza42.com/email_verified": true,
        "https://pizza42.com/orders": [],
        "https://pizza42.com/customer_profile": {
          customer_segment: "Returning Regular",
          order_count: 7,
          favourite_item: "Margherita",
        },
      },
    });

    render(<Pizza42App auth={auth} api={createApi()} />);

    const summary = screen.getByText("Technical evidence");
    expect(summary.closest("details")).not.toHaveAttribute("open");

    await user.click(summary);

    expect(summary.closest("details")).toHaveAttribute("open");
    expect(screen.getByText("ID token: client identity")).toBeInTheDocument();
    expect(
      screen.getByText("Access token: API authorization"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Simulated Segment destination"),
    ).toBeInTheDocument();
    expect(screen.queryByText("customer-access-token")).not.toBeInTheDocument();
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
    expect(
      await screen.findByText(
        /simulation unavailable; ordering is unaffected/i,
      ),
    ).toBeInTheDocument();
  });
});
