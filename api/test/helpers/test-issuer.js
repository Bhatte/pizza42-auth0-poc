import http from "node:http";

import { exportJWK, generateKeyPair, SignJWT } from "jose";

export async function createTestIssuer() {
  const keyId = "pizza42-test-key";
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  const server = http.createServer((request, response) => {
    const origin = `http://127.0.0.1:${server.address().port}`;

    response.setHeader("content-type", "application/json");

    if (request.url === "/.well-known/openid-configuration") {
      response.end(
        JSON.stringify({
          issuer: `${origin}/`,
          jwks_uri: `${origin}/.well-known/jwks.json`,
          id_token_signing_alg_values_supported: ["RS256"],
        }),
      );
      return;
    }

    if (request.url === "/.well-known/jwks.json") {
      response.end(
        JSON.stringify({
          keys: [
            {
              ...jwk,
              alg: "RS256",
              kid: keyId,
              use: "sig",
            },
          ],
        }),
      );
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not_found" }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const issuer = `http://127.0.0.1:${server.address().port}/`;

  return {
    issuer,
    async issueToken({
      audience = "https://api.pizza42.com",
      subject = "auth0|customer-42",
      scope = "",
      claims = {},
      expiresIn = "5m",
    } = {}) {
      return new SignJWT({ scope, ...claims })
        .setProtectedHeader({ alg: "RS256", kid: keyId, typ: "JWT" })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject(subject)
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(privateKey);
    },
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
