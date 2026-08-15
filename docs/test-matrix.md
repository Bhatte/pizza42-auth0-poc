# Test matrix

`Pass` means the stated evidence has been captured against the deployed environment. Local-only success is recorded separately and does not close a hosted test.

| Area | Test | Expected result | Status |
| --- | --- | --- | --- |
| Authentication | Database signup and login | Customer reaches the SPA | Not run |
| Authentication | Google login | Customer reaches the SPA | Not run |
| Authentication | Password reset | Reset completes and login succeeds | Not run |
| Verification | Unverified customer signs in | Sign-in succeeds | Not run |
| Verification | Unverified customer orders | API returns 403 with a safe error | Not run |
| Verification | Verified customer obtains fresh token | New claim is `true` | Not run |
| Authorization | No access token | API returns 401 | Not run |
| Authorization | Wrong audience | API returns 401 | Not run |
| Authorization | Expired token | API returns 401 | Not run |
| Authorization | Missing `create:orders` permission | API returns 403 | Not run |
| Ordering | Unknown menu item | API returns 400 | Not run |
| Ordering | Invalid quantity | API returns 400 | Not run |
| Ordering | Tampered client price | API ignores it and uses catalogue price | Not run |
| Ordering | Valid verified order | API returns authoritative order and total | Not run |
| Profile | Successful order | Order is present in `app_metadata.orders` | Not run |
| Claims | Fresh login after order | ID token contains order history | Not run |
| Privacy | Customer requests another user's data | Request is rejected or impossible by contract | Not run |
| Marketing | Simulated destination unavailable | Login and ordering remain available | Not run |
| Deployment | Second device and network | Hosted login and order path succeeds | Not run |

