# Known limitations

These limits are part of the POC boundary, not hidden follow-up work.

- Orders are stored in Auth0 profile metadata only because the exercise requires it. Production order data belongs in a transactional Pizza 42 datastore.
- Appending an order uses read-modify-write and is not atomic. Concurrent requests may overwrite one another.
- Full order history in an ID token does not scale. Token and profile size grow with order count.
- Email verification is read from a token claim and can remain stale until the SPA obtains a new token.
- The marketing destination is simulated. No claim is made that a Segment or Braze campaign was delivered.
- Google is the only planned social provider.
- Account linking is not implemented.
- A custom login domain may not be available on the trial tenant.
- The Flutter client is discussed in the production design but is outside the SPA-focused build.
- Migration is designed against the stated legacy hash scheme but is not run against customer data.
- The POC is not a performance or availability test for 500,000 monthly active users or event-driven peak load.
- Auth0 tenant availability and the hosted application's service levels remain those of their selected plans and providers.

