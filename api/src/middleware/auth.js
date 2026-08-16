import { auth, requiredScopes } from "express-oauth2-jwt-bearer";

export function createAuthMiddleware({ audience, issuerBaseURL }) {
  return {
    checkJwt: auth({
      audience,
      issuerBaseURL,
      tokenSigningAlg: "RS256",
    }),
    requireCreateOrders: requiredScopes("create:orders"),
    requireReadOrders: requiredScopes("read:orders"),
  };
}
