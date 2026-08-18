import { useMemo } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { jwtDecode } from "jwt-decode";

import { Pizza42App } from "./Pizza42App.jsx";
import { webConfig } from "./config.js";
import { createApiClient } from "./lib/api.js";
import { createRequestLog } from "./lib/request-log.js";
import { createTokenClassifier } from "./lib/tokens.js";

const EMAIL_VERIFIED_CLAIM = "https://pizza42.com/email_verified";

export default function App() {
  const auth0 = useAuth0();
  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: webConfig.apiBaseUrl,
        // The log names each credential by audience rather than storing it, so
        // the evidence drawer can say "access token" or "ID token" without ever
        // holding one.
        log: createRequestLog({
          classify: createTokenClassifier({
            apiAudience: webConfig.auth0Audience,
            clientId: webConfig.auth0ClientId,
          }),
        }),
      }),
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
      // Both raw tokens, for the evidence drawer alone. The storefront never
      // needs them: it sends the access token to the API and reads claims from
      // the SDK's decoded user object.
      async getRawTokens() {
        const [accessToken, idClaims] = await Promise.all([
          auth0.getAccessTokenSilently(),
          auth0.getIdTokenClaims(),
        ]);
        return { accessToken, idToken: idClaims?.__raw ?? null };
      },
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
