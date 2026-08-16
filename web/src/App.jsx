import { useMemo } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { jwtDecode } from "jwt-decode";

import { Pizza42App } from "./Pizza42App.jsx";
import { webConfig } from "./config.js";
import { createApiClient } from "./lib/api.js";

const EMAIL_VERIFIED_CLAIM = "https://pizza42.com/email_verified";

export default function App() {
  const auth0 = useAuth0();
  const api = useMemo(
    () => createApiClient({ baseUrl: webConfig.apiBaseUrl }),
    [],
  );
  const auth = useMemo(
    () => ({
      isAuthenticated: auth0.isAuthenticated,
      isLoading: auth0.isLoading,
      user: auth0.user,
      idTokenClaims: auth0.user,
      loginWithRedirect: auth0.loginWithRedirect,
      logout: () =>
        auth0.logout({
          logoutParams: { returnTo: window.location.origin },
        }),
      getAccessTokenSilently: auth0.getAccessTokenSilently,
      async refreshVerification() {
        const accessToken = await auth0.getAccessTokenSilently({
          cacheMode: "off",
          authorizationParams: {
            audience: webConfig.auth0Audience,
            scope: "create:orders read:orders",
          },
        });
        const claims = jwtDecode(accessToken);
        return claims[EMAIL_VERIFIED_CLAIM] === true;
      },
    }),
    [auth0],
  );

  return <Pizza42App auth={auth} api={api} />;
}
