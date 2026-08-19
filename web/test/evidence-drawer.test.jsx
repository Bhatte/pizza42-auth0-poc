import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EvidenceDrawer } from "../src/EvidenceDrawer.jsx";

const API_AUDIENCE = "https://api.pizza42.com";
const CLIENT_ID = "sTdY6qgVpN2mKcR8wZ0hLb4XeF7uJ1nA";
const SUB = "google-oauth2|113742059188212345678";
const STORE = "Dublin Camden Street";

function jwt(payload) {
  const encode = (value) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${encode({ alg: "RS256" })}.${encode(payload)}.AAAAsignature`;
}

const now = Math.floor(Date.now() / 1000);

const PROFILE = {
  customer_segment: "Returning Regular",
  order_count: 6,
  favourite_item: "Margherita",
  favourite_store: STORE,
  last_item_ordered: "Garden Veg",
  last_order_at: "2026-08-16T19:41:02.100Z",
  average_order_value: 22.83,
  identity_provider: "google-oauth2",
};

const ID_TOKEN = jwt({
  sub: SUB,
  email: "maya@example.com",
  iss: "https://tenant.eu.auth0.com/",
  aud: CLIENT_ID,
  exp: now + 3600,
  "https://pizza42.com/email_verified": true,
  "https://pizza42.com/orders": [{ id: "ord_1" }, { id: "ord_2" }],
  "https://pizza42.com/customer_profile": PROFILE,
});

const ACCESS_TOKEN = jwt({
  sub: SUB,
  iss: "https://tenant.eu.auth0.com/",
  aud: [API_AUDIENCE],
  exp: now + 7200,
  scope: "create:orders read:orders",
  "https://pizza42.com/email_verified": true,
});

function createAuth(overrides = {}) {
  return {
    idTokenClaims: { sub: SUB },
    getRawTokens: vi
      .fn()
      .mockResolvedValue({ accessToken: ACCESS_TOKEN, idToken: ID_TOKEN }),
    ...overrides,
  };
}

function createInsight(overrides = {}) {
  return {
    claimedProfile: PROFILE,
    liveProfile: PROFILE,
    marketingStatus: "ready",
    claimedOrderCount: 6,
    liveOrderCount: 6,
    event: { type: "identify", userId: SUB, traits: PROFILE },
    ...overrides,
  };
}

function renderDrawer({ auth, insight, ...rest } = {}) {
  const onClose = vi.fn();
  const result = render(
    <EvidenceDrawer
      open
      onClose={onClose}
      auth={auth ?? createAuth()}
      isVerified
      insight={insight ?? createInsight()}
      {...rest}
    />,
  );
  return { ...result, onClose };
}

async function openTab(user, name) {
  await user.click(screen.getByRole("tab", { name }));
}

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
    writable: true,
  });
});

describe("Behind the counter", () => {
  it("renders nothing at all while it is closed", () => {
    const { container } = render(
      <EvidenceDrawer
        open={false}
        onClose={vi.fn()}
        auth={createAuth()}
        isVerified
        insight={createInsight()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("reads each token and shows what only one of them carries", async () => {
    renderDrawer();

    // The audience row is the argument: addressed to the application on one
    // side, to the API on the other.
    expect(await screen.findByText(CLIENT_ID)).toBeInTheDocument();
    expect(screen.getAllByText(API_AUDIENCE).length).toBeGreaterThan(0);
    expect(screen.getByText("create:orders read:orders")).toBeInTheDocument();
    expect(screen.getByText("2 orders")).toBeInTheDocument();
    expect(screen.getByText("8 traits")).toBeInTheDocument();
    // Scope, order history and the profile are each absent from one side.
    expect(screen.getAllByText("not present").length).toBe(3);
  });

  it("counts down to expiry rather than printing a timestamp", async () => {
    renderDrawer();

    // Both tokens count down; the access token outlives the ID token.
    expect((await screen.findAllByText(/left$/)).length).toBe(2);
  });

  it("reports a session it could not read instead of showing an empty table", async () => {
    const auth = createAuth({
      getRawTokens: vi.fn().mockRejectedValue(new Error("no session")),
    });
    renderDrawer({ auth });

    expect(
      await screen.findByText(/session could not be read/i),
    ).toBeInTheDocument();
  });

  it("hands the access token to the clipboard when asked", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderDrawer();

    await user.click(
      await screen.findByRole("button", { name: /copy access/i }),
    );

    expect(writeText).toHaveBeenCalledWith(ACCESS_TOKEN);
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("says the copy was blocked rather than appearing to have worked", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    renderDrawer();

    await user.click(await screen.findByRole("button", { name: /copy id/i }));

    expect(await screen.findByText("Blocked")).toBeInTheDocument();
  });

  it("moves between tabs with the arrow keys, as the role promises", async () => {
    const user = userEvent.setup();
    renderDrawer();

    const session = screen.getByRole("tab", { name: "Session" });
    session.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Insight" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.keyboard("{ArrowLeft}");
    expect(session).toHaveAttribute("aria-selected", "true");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });
});

describe("Behind the counter — insight", () => {
  it("shows the segment and how far it is to the next one", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await openTab(user, "Insight");

    const card = screen.getByText("6 orders on file").closest(".segment-card");
    expect(within(card).getByText("Returning Regular")).toBeInTheDocument();
    expect(
      within(card).getByText("4 more to Loyal Regular"),
    ).toBeInTheDocument();
    // Money and the provider are formatted for reading, not printed raw. Each
    // appears in the summary grid and again in the comparison row.
    expect(screen.getAllByText("€22.83").length).toBe(3);
    expect(screen.getAllByText("Google").length).toBe(3);
  });

  it("says both sides agree when nothing has happened since sign-in", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await openTab(user, "Insight");

    expect(screen.getByText("Both sides agree")).toBeInTheDocument();
  });

  it("marks the traits that have moved since the token was signed", async () => {
    const user = userEvent.setup();
    const insight = createInsight({
      liveProfile: {
        ...PROFILE,
        order_count: 7,
        last_item_ordered: "Margherita",
      },
      liveOrderCount: 7,
    });
    renderDrawer({ insight });

    await openTab(user, "Insight");

    expect(
      screen.getByText("2 traits have moved since sign-in"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/describes sign-in, not what happened after/i),
    ).toBeInTheDocument();
  });

  it("falls back to the signed claim when the destination is unavailable", async () => {
    const user = userEvent.setup();
    const insight = createInsight({
      liveProfile: null,
      marketingStatus: "unavailable",
      event: null,
      liveOrderCount: null,
    });
    renderDrawer({ insight });

    await openTab(user, "Insight");

    expect(screen.getByText(/destination did not answer/i)).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Simulated marketing payload").textContent,
    ).toContain("Returning Regular");
  });

  it("reports the top segment without inventing a tier above it", async () => {
    const user = userEvent.setup();
    const insight = createInsight({
      liveProfile: {
        ...PROFILE,
        order_count: 14,
        customer_segment: "Loyal Regular",
      },
      claimedProfile: {
        ...PROFILE,
        order_count: 14,
        customer_segment: "Loyal Regular",
      },
    });
    renderDrawer({ insight });

    await openTab(user, "Insight");

    expect(screen.getByText("Highest segment reached")).toBeInTheDocument();
  });
});
