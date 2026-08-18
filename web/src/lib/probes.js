import { tamperSignature } from "./tokens.js";

// The requests a reviewer would otherwise open Postman or an intercepting proxy
// to make. They run against the deployed API from the page itself, so the
// status and body shown are the real ones.
//
// Every probe is designed to be *refused*. Each rejection happens in the API's
// authentication, scope, verification or schema layer — all of which sit in
// front of the profile write — so running the whole set changes nothing. There
// is deliberately no probe here that succeeds: a probe that placed an order
// would make the panel wonder what else this panel can do.

const MARGHERITA = "PIZ-MARG-L";

function basket(store, items = [{ sku: MARGHERITA, qty: 1 }]) {
  return { store, items };
}

export const PROBES = [
  {
    id: "anonymous-read",
    group: "Authentication",
    title: "No credential at all",
    method: "GET",
    path: "/api/orders",
    credential: null,
    expect: { status: 401, error: "authentication_required" },
    proves:
      "Being signed in is not what authorises the call. Strip the token and the same endpoint returns nothing, so no screenshot of a logged-in interface is evidence of authorisation.",
  },
  {
    id: "id-token-as-credential",
    group: "Authentication",
    title: "ID token presented as the API credential",
    method: "POST",
    path: "/api/orders",
    credential: "id",
    body: basket,
    expect: { status: 401 },
    proves:
      "An ID token is a statement to this application about who signed in. It is addressed to the application's client ID, not to the orders API, so the API refuses it on audience. The two tokens are not interchangeable.",
  },
  {
    id: "tampered-signature",
    group: "Authentication",
    title: "Access token with one character of the signature changed",
    method: "POST",
    path: "/api/orders",
    credential: "tampered",
    body: basket,
    expect: { status: 401 },
    proves:
      "Header and payload are untouched, so the claims still read perfectly. The API rejects it anyway, because it verifies the RS256 signature against the tenant's published key rather than reading the token it was handed.",
  },
  {
    id: "unverified-order",
    group: "Verification",
    title: "Order placed before the email is confirmed",
    method: "POST",
    path: "/api/orders",
    credential: "access",
    body: basket,
    expect: { status: 403, error: "email_not_verified" },
    availableWhen: ({ verified }) => !verified,
    unavailableBecause: "This account has already confirmed its email.",
    proves:
      "A fully valid token with the right scope is still refused. Verification is enforced at the API from a signed claim, not by hiding the button in the browser.",
  },
  {
    id: "unknown-item",
    group: "Ordering",
    title: "An item that is not on the menu",
    method: "POST",
    path: "/api/orders",
    credential: "access",
    body: (store) => basket(store, [{ sku: "PIZ-TRUFFLE-XL", qty: 1 }]),
    expect: { status: 400, error: "unknown_sku" },
    proves:
      "The catalogue belongs to the API. A browser cannot invent a menu item, and an unrecognised item fails the whole order rather than being quietly dropped from it.",
  },
  {
    id: "prototype-item",
    group: "Ordering",
    title: "A prototype-chain name used as an item code",
    method: "POST",
    path: "/api/orders",
    credential: "access",
    body: (store) => basket(store, [{ sku: "__proto__", qty: 1 }]),
    expect: { status: 400, error: "unknown_sku" },
    proves:
      "Item lookup is an own-property check. A bare object index would have resolved this to an inherited member, passed the unknown-item guard, and stored an order with a total of NaN.",
  },
  {
    id: "client-priced-order",
    group: "Ordering",
    title: "An order that supplies its own prices",
    method: "POST",
    path: "/api/orders",
    credential: "access",
    body: (store) => ({
      ...basket(store, [{ sku: MARGHERITA, qty: 1, unit_price: 0.01 }]),
      total: 0.01,
      currency: "EUR",
    }),
    expect: { status: 400, error: "invalid_order" },
    proves:
      "The order schema is strict, so unexpected fields are a rejection rather than something to ignore. The browser sends item codes and quantities; unit price, line total and order total are all resolved by the API.",
  },
  {
    id: "over-ceiling-quantity",
    group: "Ordering",
    title: "A quantity above the published ceiling",
    method: "POST",
    path: "/api/orders",
    credential: "access",
    body: (store) => basket(store, [{ sku: MARGHERITA, qty: 21 }]),
    expect: { status: 400, error: "invalid_order" },
    proves:
      "The basket's + button stops at twenty as a courtesy. This shows the ceiling is also enforced where it counts, and that the published limit and the enforced limit are the same number.",
  },
];

function credentialFor(kind, { accessToken, idToken }) {
  if (kind === "access") return accessToken;
  if (kind === "id") return idToken;
  if (kind === "tampered") return tamperSignature(accessToken);
  return null;
}

const CREDENTIAL_SHELL_VARIABLE = {
  access: "$ACCESS_TOKEN",
  id: "$ID_TOKEN",
  tampered: "$ACCESS_TOKEN_WITH_LAST_CHARACTER_CHANGED",
};

// Shown beside each probe so a sceptic can reproduce it from their own terminal
// rather than take the page's word for it. Credentials are shell variables, so
// the command stays safe to project onto a wall.
export function curlFor(probe, store) {
  const lines = [`curl -i -X ${probe.method} "$PIZZA42_API${probe.path}"`];
  const variable = CREDENTIAL_SHELL_VARIABLE[probe.credential];
  if (variable) lines.push(`  -H "authorization: Bearer ${variable}"`);
  if (probe.body) {
    lines.push(`  -H "content-type: application/json"`);
    lines.push(`  -d '${JSON.stringify(probe.body(store))}'`);
  }
  return lines.join(" \\n");
}

export function isAvailable(probe, context) {
  return probe.availableWhen ? probe.availableWhen(context) : true;
}

export async function runProbe(
  probe,
  { baseUrl, accessToken, idToken, store, fetchRequest = fetch },
) {
  const headers = {};
  const credential = credentialFor(probe.credential, { accessToken, idToken });
  if (credential) headers.authorization = `Bearer ${credential}`;

  const body = probe.body?.(store);
  if (body) headers["content-type"] = "application/json";

  const startedAt = Date.now();
  const response = await fetchRequest(`${baseUrl}${probe.path}`, {
    method: probe.method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  // A rate limiter or gateway can answer a probe with HTML. Report that as what
  // it is instead of failing the probe with a parse error.
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = { note: "The response body was not JSON." };
  }

  return {
    status: response.status,
    ms: Date.now() - startedAt,
    body: payload,
    matched:
      response.status === probe.expect.status &&
      (!probe.expect.error || payload?.error === probe.expect.error),
  };
}
