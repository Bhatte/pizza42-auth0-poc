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
      cacheLocation="memory"
    >
      <App />
    </Auth0Provider>
  </StrictMode>,
);
