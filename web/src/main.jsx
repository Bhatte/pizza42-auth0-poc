import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";

import App from "./App.jsx";
import { webConfig } from "./config.js";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Auth0Provider
      domain={webConfig.auth0Domain}
      clientId={webConfig.auth0ClientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: webConfig.auth0Audience,
        scope: "openid profile email offline_access create:orders read:orders",
      }}
      useRefreshTokens
      // Memory storage is the safer default and was the original choice, but it
      // makes a page refresh look like a sign-out: the tokens are gone, and the
      // silent re-authentication that would recover them needs Auth0's session
      // cookie, which is third-party to this domain and blocked by default in
      // current browsers. The customer sees themselves logged out for pressing
      // reload, which is not a defensible ordering experience.
      //
      // The refresh token therefore persists, and the exposure that creates is
      // answered directly: rotation with reuse detection is on in the tenant, so
      // a stolen token is single-use and its reuse invalidates the family, and
      // the Content Security Policy in vercel.json blocks the inline script that
      // is the usual way such a token would be read. The production answer is a
      // custom Auth0 domain, which makes the session cookie first-party and lets
      // this go back to memory; see docs/known-limitations.md.
      cacheLocation="localstorage"
    >
      <App />
    </Auth0Provider>
  </StrictMode>,
);
