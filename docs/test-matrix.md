# Test matrix

`Pass` means the stated evidence has been captured against the deployed environment. Local-only success is recorded separately and does not close a hosted test.

| Area           | Test                                                     | Expected result                                         | Status                               |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------ |
| Authentication | Database signup and login                                | Customer reaches the SPA                                | Hosted: not run                      |
| Authentication | Google login                                             | Customer reaches the SPA                                | Hosted: not run                      |
| Authentication | Password reset                                           | Reset completes and login succeeds                      | Hosted: not run                      |
| Verification   | Unverified customer signs in                             | Sign-in succeeds                                        | Hosted: not run                      |
| Verification   | Unverified customer orders                               | API returns 403 with a safe error                       | Local automated: pass                |
| Verification   | Verified customer obtains fresh token                    | Cache bypass returns a new claim of `true`              | Local adapter: pass; hosted: not run |
| Authorization  | No access token                                          | API returns 401                                         | Local automated: pass                |
| Authorization  | Wrong audience                                           | API returns 401                                         | Local signed JWT: pass               |
| Authorization  | Expired token                                            | API returns 401                                         | Local signed JWT: pass               |
| Authorization  | Missing `create:orders` permission                       | API returns 403 and required scope challenge            | Local signed JWT: pass               |
| Ordering       | Unknown menu item                                        | API returns 400                                         | Local automated: pass                |
| Ordering       | Invalid quantity                                         | API returns 400                                         | Local automated: pass                |
| Ordering       | Tampered client price                                    | API rejects fields and never accepts the supplied total | Local automated: pass                |
| Ordering       | Valid verified order                                     | API returns authoritative order and total               | Local automated: pass                |
| Profile        | Successful order                                         | Order is present in `app_metadata.orders`               | Adapter: pass; hosted: not run       |
| Claims         | Fresh login after order                                  | ID token contains order history                         | Action: pass; hosted: not run        |
| Privacy        | Customer requests another user's order or marketing data | Only token-subject data is returned                     | Local automated: pass                |
| Marketing      | Simulated destination unavailable                        | Login and ordering remain available                     | Local UI: pass                       |
| Deployment     | Second device and network                                | Hosted login and order path succeeds                    | Hosted: not run                      |
