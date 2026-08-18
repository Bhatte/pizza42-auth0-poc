# Requirements traceability

This matrix maps the ten implementation requirements to the planned evidence. Status is conservative: a requirement is complete only when the hosted path and its relevant failure case have been exercised.

|   # | Requirement                                                          | Planned implementation                       | Evidence                                                                                                     | Status                          |
| --: | -------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------- |
|   1 | Configure Auth0 applications, APIs, database, and social connections | Repeatable tenant checklist                  | Live tenant read-back and documented configuration                                                           | Complete                        |
|   2 | Use the single-page application path                                 | React SPA                                    | Production build plus hosted application                                                                     | Complete                        |
|   3 | Use a JavaScript framework                                           | React with Vite                              | `web/` package and production build                                                                          | Complete                        |
|   4 | Complete login                                                       | Auth0 Universal Login                        | Database login smoke test and successful Auth0 logs                                                          | Complete                        |
|   5 | Call an API and store orders in the profile                          | Express orders API and Management API client | API tests plus five live orders inspected before demo-data reset                                             | Complete                        |
|   6 | Support email/password and social login                              | Auth0 database connection and Google         | Successful database and Google identities plus tenant logs                                                   | Complete                        |
|   7 | Require verified email for ordering, not sign-in                     | Namespaced claim checked by API middleware   | Signed-JWT 403 tests plus an unverified identity with successful logins                                      | Complete                        |
|   8 | Require a valid token and operation-specific scope                   | JWT validation and `create:orders` scope     | Hosted 401/403 tests and automated issuer/audience/expiry tests                                              | Complete                        |
|   9 | Save an order to the Auth0 profile                                   | Append to `app_metadata.orders`              | Live `app_metadata.orders` inspection before demo-data reset                                                 | Complete                        |
|  10 | Add order history to the ID token at login                           | Auth0 Post-Login Action                      | Claim shown in Session details; Action tests and shared golden fixtures; recapture a fresh token after reset | Deployed; evidence to recapture |

## Acceptance rule

UI state is not evidence of authorization. Requirements 7 and 8 must be proved by direct API calls that bypass the SPA. Requirement 9 must be verified in the Auth0 profile, and requirement 10 requires a newly issued ID token.

The Auth0 user store was reset after validation on 17 August 2026. Recreate
demo identities and order data before recording new screenshots or running a
panel rehearsal.
