# Requirements traceability

This matrix maps the ten implementation requirements to the planned evidence. Status is conservative: a requirement is complete only when the hosted path and its relevant failure case have been exercised.

| # | Requirement | Planned implementation | Evidence | Status |
| ---: | --- | --- | --- | --- |
| 1 | Configure Auth0 applications, APIs, database, and social connections | Documented tenant configuration | Tenant notes and screenshots with secrets removed | Not started |
| 2 | Use the single-page application path | React SPA | Hosted application and source | Not started |
| 3 | Use a JavaScript framework | React with Vite | `web/` package | Not started |
| 4 | Complete login | Auth0 Universal Login | Database login smoke test | Not started |
| 5 | Call an API and store orders in the profile | Express orders API and Management API client | API test plus sanitized profile evidence | Not started |
| 6 | Support email/password and social login | Auth0 database connection and Google | Separate login smoke tests | Not started |
| 7 | Require verified email for ordering, not sign-in | Namespaced claim checked by API middleware | Unverified sign-in succeeds; order returns 403 | Not started |
| 8 | Require a valid token and operation-specific scope | JWT validation and `create:orders` scope | No-token 401 and wrong-scope 403 tests | Not started |
| 9 | Save an order to the Auth0 profile | Append to `app_metadata.orders` | Sanitized before/after profile evidence | Not started |
| 10 | Add order history to the ID token at login | Auth0 Post-Login Action | Decoded ID-token claim after a fresh login | Not started |

## Acceptance rule

UI state is not evidence of authorization. Requirements 7 and 8 must be proved by direct API calls that bypass the SPA. Requirement 9 must be verified in the Auth0 profile, and requirement 10 requires a newly issued ID token.

