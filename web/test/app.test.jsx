import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth0: undefined,
  jwtDecode: vi.fn(),
}));

vi.mock("@auth0/auth0-react", () => ({
  useAuth0: () => mocks.auth0,
}));

vi.mock("jwt-decode", () => ({ jwtDecode: mocks.jwtDecode }));

vi.mock("../src/config.js", () => ({
  webConfig: {
    apiBaseUrl: "https://api.pizza42.example",
    auth0Audience: "https://api.pizza42.com",
  },
}));

vi.mock("../src/Pizza42App.jsx", () => ({
  Pizza42App: ({ auth }) => (
    <div>
      <span>{auth.isAuthenticated ? "authenticated" : "guest"}</span>
      <button type="button" onClick={auth.loginWithRedirect}>
        Login
      </button>
      <button type="button" onClick={auth.logout}>
        Logout
      </button>
      <button
        type="button"
        onClick={async () => {
          const verified = await auth.refreshVerification();
          document.body.dataset.verified = String(verified);
        }}
      >
        Refresh verification
      </button>
    </div>
  ),
}));

import App from "../src/App.jsx";

describe("Auth0 application adapter", () => {
  beforeEach(() => {
    document.body.removeAttribute("data-verified");
    mocks.jwtDecode.mockReset();
    mocks.auth0 = {
      isAuthenticated: true,
      isLoading: false,
      user: { sub: "auth0|customer-42" },
      loginWithRedirect: vi.fn(),
      logout: vi.fn(),
      getAccessTokenSilently: vi.fn().mockResolvedValue("fresh-access-token"),
    };
  });

  it("maps Auth0 login and logout without persisting browser tokens", async () => {
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Login" }));
    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(mocks.auth0.loginWithRedirect).toHaveBeenCalledOnce();
    expect(mocks.auth0.logout).toHaveBeenCalledWith({
      logoutParams: { returnTo: window.location.origin },
    });
  });

  it("bypasses the token cache when checking a newly verified email", async () => {
    const user = userEvent.setup();
    mocks.jwtDecode.mockReturnValue({
      "https://pizza42.com/email_verified": true,
    });

    render(<App />);
    await user.click(
      screen.getByRole("button", { name: "Refresh verification" }),
    );

    expect(mocks.auth0.getAccessTokenSilently).toHaveBeenCalledWith({
      cacheMode: "off",
      authorizationParams: {
        audience: "https://api.pizza42.com",
        scope: "create:orders read:orders",
      },
    });
    expect(document.body.dataset.verified).toBe("true");
  });
});
