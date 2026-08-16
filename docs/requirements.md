# Requirements traceability

This matrix maps the ten implementation requirements to the planned evidence. Status is conservative: a requirement is complete only when the hosted path and its relevant failure case have been exercised.

|   # | Requirement                                                          | Planned implementation                       | Evidence                                                             | Status                             |
| --: | -------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------- |
|   1 | Configure Auth0 applications, APIs, database, and social connections | Repeatable tenant checklist                  | Tenant notes and screenshots with secrets removed                    | Documented; tenant pending         |
|   2 | Use the single-page application path                                 | React SPA                                    | Production build plus hosted application                             | Implemented locally                |
|   3 | Use a JavaScript framework                                           | React with Vite                              | `web/` package and production build                                  | Implemented locally                |
|   4 | Complete login                                                       | Auth0 Universal Login                        | Database login smoke test                                            | Client implemented; tenant pending |
|   5 | Call an API and store orders in the profile                          | Express orders API and Management API client | API and adapter tests plus sanitized profile evidence                | Implemented locally                |
|   6 | Support email/password and social login                              | Auth0 database connection and Google         | Separate login smoke tests                                           | Tenant pending                     |
|   7 | Require verified email for ordering, not sign-in                     | Namespaced claim checked by API middleware   | Signed-JWT unverified 403 test and hosted login evidence             | Implemented locally                |
|   8 | Require a valid token and operation-specific scope                   | JWT validation and `create:orders` scope     | Missing, expired, wrong-audience, and wrong-scope tests              | Implemented locally                |
|   9 | Save an order to the Auth0 profile                                   | Append to `app_metadata.orders`              | Management adapter test plus sanitized before/after profile evidence | Implemented locally                |
|  10 | Add order history to the ID token at login                           | Auth0 Post-Login Action                      | Action tests plus decoded ID-token claim after a fresh login         | Implemented locally                |

## Acceptance rule

UI state is not evidence of authorization. Requirements 7 and 8 must be proved by direct API calls that bypass the SPA. Requirement 9 must be verified in the Auth0 profile, and requirement 10 requires a newly issued ID token.
