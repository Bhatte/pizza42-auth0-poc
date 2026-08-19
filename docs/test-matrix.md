# Test matrix

`Hosted: pass` means the stated evidence was captured against the deployed
environment. Local-only success is recorded separately and does not close a
hosted test.

Deployed API: `https://pizza42-api.tejasbhat.com` (alias `pizza42-api.vercel.app`)
Deployed SPA: `https://pizza42.tejasbhat.com` (alias `pizza42-web.vercel.app`)
Tenant: `tejasbhat.eu.auth0.com`

Both origins are recorded because the SPA's Content Security Policy lists the
API origin literally. On 18 August 2026 this file named only the `vercel.app`
alias while the deployed bundle called the custom domain, and the first CSP was
written from the documentation rather than from the bundle — it would have
blocked every API call. Check the built bundle, not this table, when changing
the policy.

## Verified against the deployed system

| Area          | Test                                     | Expected                                        | Status                          |
| ------------- | ---------------------------------------- | ----------------------------------------------- | ------------------------------- |
| Deployment    | API reachable                            | `GET /api/health` returns 200                   | Hosted: pass                    |
| Deployment    | SPA reachable                            | Document served, correct title                  | Hosted: pass                    |
| Deployment    | SPA bundle carries no secret             | No M2M or Google secret in the JS bundle        | Hosted: pass                    |
| Catalogue     | Server-owned menu                        | 3 items and 3 stores returned by the API        | Hosted: pass                    |
| Authorization | No access token                          | 401 `authentication_required`                   | Hosted: pass                    |
| Authorization | Malformed bearer token                   | 401, no exception leaked                        | Hosted: pass                    |
| Authorization | Real Auth0 token missing `create:orders` | 403 `insufficient_scope` + scope challenge      | Hosted: pass, real tenant token |
| Web security  | CORS from the SPA origin                 | Exact origin echoed                             | Hosted: pass                    |
| Web security  | CORS from an untrusted origin            | No `Access-Control-Allow-Origin`                | Hosted: pass                    |
| Identity      | RBAC disabled                            | Token carries `scope`, no `permissions` claim   | Tenant: pass                    |
| Identity      | Universal Login reachable                | `/authorize` redirects to the hosted login page | Tenant: pass                    |
| Web security  | SPA carries CSP, HSTS and framing denial | Headers present on the hosted document          | Not run: verify after redeploy  |
| Web security  | Silent authentication under the CSP      | Session restores; no `frame-src` violation      | Not run: verify after redeploy  |

## Verified locally against the real tenant

| Area          | Test                                       | Expected                                   | Status             |
| ------------- | ------------------------------------------ | ------------------------------------------ | ------------------ |
| Authorization | Wrong scope, real tenant-issued token      | 403 with `scope="create:orders"` challenge | Pass               |
| Resilience    | Management API failure                     | 502 `identity_store_unavailable`, logged   | Pass               |
| Web security  | Production bundle behind the shipping CSP  | Page loads with no CSP violation           | Pass: local origin |
| Web security  | `auth0-spa-js` blob Web Worker under CSP   | Worker spawns; no `script-src` violation   | Pass: local origin |
| Tenant        | `tenant-config.md` matches the live tenant | Every documented value reads back equal    | Pass: 18 Aug 2026  |

The CSP rows were exercised by serving the production build behind the exact
headers in `web/vercel.json`. The first attempt **failed**: `script-src 'self'`
blocked the `blob:` Web Worker `auth0-spa-js` uses to hold refresh tokens, which
is why `worker-src 'self' blob:` is in the policy. `frame-src` for the tenant is
present and correct for the SDK's silent-authentication iframe, but the SDK only
attempts that iframe when its session cookie exists, so **that directive is
reasoned, not yet observed** — confirm it on the hosted origin after a real
login before the rehearsal.

## Verified by automated test only

| Area          | Test                                          | Expected                                      | Status |
| ------------- | --------------------------------------------- | --------------------------------------------- | ------ |
| Authorization | Wrong audience / expired / foreign issuer     | 401                                           | Pass   |
| Verification  | Unverified customer orders                    | 403 `email_not_verified`                      | Pass   |
| Verification  | Verification claim absent or a string         | 403 — fails closed                            | Pass   |
| Ordering      | Unknown SKU                                   | 400 `unknown_sku`                             | Pass   |
| Ordering      | Prototype-chain SKU (`toString`, `__proto__`) | 400 `unknown_sku`                             | Pass   |
| Ordering      | No order can persist a non-finite total       | Only the valid order is stored                | Pass   |
| Ordering      | Invalid quantity, tampered price or total     | 400                                           | Pass   |
| Ordering      | Basket cannot exceed the API quantity ceiling | Control stops at 20 and says so               | Pass   |
| Privacy       | Another customer's orders or marketing events | Only token-subject data returned              | Pass   |
| Resilience    | Non-JSON API response reaches the SPA         | Customer-readable message, not a parse error  | Pass   |
| Resilience    | Order history unreadable after a placed order | Confirmation stands, history says so          | Pass   |
| Verification  | Refresh fails or returns still-unverified     | Distinct message, button re-enabled           | Pass   |
| History       | Order placed without a new sign-in            | Appears in Recent orders immediately          | Pass   |
| Marketing     | Browser-supplied traits ignored               | Traits derived server-side from `sub`         | Pass   |
| Marketing     | Action and API derive identical profiles      | Shared golden fixtures agree in both suites   | Pass   |
| Contract      | `/api/meta` publishes the enforced ceiling    | Published limit accepted, one above rejected  | Pass   |
| Contract      | `/api/meta` carries no credential or secret   | Payload free of secret material               | Pass   |
| Evidence      | Claim table survives a token it cannot read   | Unreadable token decodes to nothing, not part | Pass   |
| Evidence      | Panel is absent until it is asked for         | No evidence in the ordering view until opened | Pass   |

The foreign-issuer row is proved with a second test issuer that signs with its
own key under the same `kid`, so it exercises signature verification rather
than key lookup. The parity row was checked by changing a segment threshold in
the Action alone and confirming both suites fail.

## Interactive browser validation

| Area           | Test                                 | Expected                                    | Status                                     |
| -------------- | ------------------------------------ | ------------------------------------------- | ------------------------------------------ |
| Authentication | Database signup and login            | Customer reaches the SPA                    | Pass: live tenant                          |
| Authentication | Google login                         | Customer reaches the SPA                    | Pass: custom Google keys                   |
| Authentication | Password reset                       | Reset completes and login succeeds          | Not run                                    |
| Verification   | Unverified customer signs in         | Sign-in succeeds, ordering blocked          | Sign-in observed; API block automated      |
| Verification   | Fresh token after verifying          | Cache bypass returns claim `true`           | Automated; capture again after reset       |
| Ordering       | Verified customer places an order    | 201 with authoritative total                | Pass: five live orders                     |
| Profile        | Order lands in `app_metadata.orders` | Order present in the Auth0 profile          | Pass: inspected live                       |
| Claims         | Fresh login after ordering           | ID token contains order history and profile | Action deployed; capture again after reset |
| Marketing      | Derived traits for a seeded account  | `favourite_store`, `last_item_ordered` set  | Automated; reseed before rehearsal         |
| Deployment     | Second device and network            | Hosted login and order path succeeds        | Not run                                    |

The Google connection now uses Pizza 42-owned Google Cloud OAuth credentials.
The tenant's four validation identities and five orders were deleted on 17
August 2026. The pass rows record evidence observed before that intentional
reset; create fresh data before the next rehearsal.

## Acceptance rule

UI state is not evidence of authorization. The authorization and verification
rows must be proved by direct API calls that bypass the SPA. The profile row
must be verified in the Auth0 profile, and the claims row requires a newly
issued ID token.
