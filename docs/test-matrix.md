# Test matrix

`Hosted: pass` means the stated evidence was captured against the deployed
environment. Local-only success is recorded separately and does not close a
hosted test.

Deployed API: `https://pizza42-api.vercel.app`
Deployed SPA: `https://pizza42-web.vercel.app`
Tenant: `tejasbhat.eu.auth0.com`

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

## Verified locally against the real tenant

| Area          | Test                                  | Expected                                   | Status |
| ------------- | ------------------------------------- | ------------------------------------------ | ------ |
| Authorization | Wrong scope, real tenant-issued token | 403 with `scope="create:orders"` challenge | Pass   |
| Resilience    | Management API failure                | 502 `identity_store_unavailable`, logged   | Pass   |

## Verified by automated test only

| Area          | Test                                          | Expected                                     | Status |
| ------------- | --------------------------------------------- | -------------------------------------------- | ------ |
| Authorization | Wrong audience / expired / foreign issuer     | 401                                          | Pass   |
| Verification  | Unverified customer orders                    | 403 `email_not_verified`                     | Pass   |
| Verification  | Verification claim absent or a string         | 403 — fails closed                           | Pass   |
| Ordering      | Unknown SKU                                   | 400 `unknown_sku`                            | Pass   |
| Ordering      | Prototype-chain SKU (`toString`, `__proto__`) | 400 `unknown_sku`                            | Pass   |
| Ordering      | No order can persist a non-finite total       | Only the valid order is stored               | Pass   |
| Ordering      | Invalid quantity, tampered price or total     | 400                                          | Pass   |
| Privacy       | Another customer's orders or marketing events | Only token-subject data returned             | Pass   |
| Resilience    | Non-JSON API response reaches the SPA         | Customer-readable message, not a parse error | Pass   |
| Marketing     | Browser-supplied traits ignored               | Traits derived server-side from `sub`        | Pass   |

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
