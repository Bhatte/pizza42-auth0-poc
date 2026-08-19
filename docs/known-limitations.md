# Known limitations

These limits are part of the POC boundary, not hidden follow-up work.

- Orders are stored in Auth0 profile metadata only because the exercise requires it. Production order data belongs in a transactional Pizza 42 datastore.
- Appending an order uses read-modify-write and is not atomic. Concurrent requests may overwrite one another.
- Order creation is not idempotent. There is no client-supplied idempotency key and no server-side record of one, so a retry after a response is lost in transit creates a second order. Production belongs with the Pizza 42 order service, where the idempotency key and the transaction commit live together.
- Money is a JavaScript number rounded to two decimal places. That is exact for this catalogue — three prices, at most twenty of each — but a production commerce system should carry integer minor units or a decimal type rather than rely on the arithmetic staying small.
- Full order history in an ID token does not scale. Token and profile size grow with order count.
- Email verification is read from a token claim and can remain stale until the SPA obtains a new token.
- The marketing destination is simulated. No claim is made that a Segment or Braze campaign was delivered.
- Simulated marketing events are held in a bounded in-memory ring buffer and disappear when the API restarts.
- API rate limiting is process-local. A production deployment needs a shared limiter at the edge or a distributed backing store.
- The refresh token is persisted in `localStorage` rather than held in memory, so a page refresh does not appear to sign the customer out. Memory storage is safer in principle, but recovering from it requires silent authentication through Auth0's session cookie, which is third-party to this origin and blocked by default in current browsers. The exposure is bounded rather than accepted: refresh-token rotation with reuse detection is enabled in the tenant, and the SPA's Content Security Policy forbids inline script. The production answer is a custom Auth0 domain, which makes the session cookie first-party and allows memory-only storage with no visible cost; that is not assumed to be available on a trial tenant.
- The API is deployed as a serverless function, so the marketing ring buffer and the Management API token cache do not survive between invocations. `GET /api/marketing/events` therefore returns only events from the same warm instance.
- Auth0 Management API per-tenant rate limits, not the API itself, are the scaling ceiling on the ordering path. This is the main reason production keeps orders in a Pizza 42 datastore.
- The evidence panel decodes tokens in the browser for display. That is reading, not verification, and no decision anywhere in the system depends on it. It also offers a token to the clipboard, which is a deliberate demonstration affordance and a real bearer credential: it is appropriate for a proof of concept with a presenter at the keyboard, and would not ship to customers.
- The segment thresholds used to draw the progress bar in the evidence panel are a third copy of a rule that lives in the Action and the API. Only the bar depends on them; the segment name always comes from the server payload, so drift degrades an illustration rather than a result.
- A customer who uses both sign-in methods has two accounts, and their order history is split across them. This is deliberate and the reasoning is in [design-decisions.md](design-decisions.md).
- No custom email provider is configured, so transactional email uses Auth0's built-in development service: rate-limited, Auth0-branded, and sent from an unmonitored address whose stock copy invites a reply that goes nowhere. A branded password-reset template is written and waiting in `auth0/emails/`; applying it requires a provider first.
- Google is the only planned social provider.
- Account linking is not implemented.
- A custom login domain may not be available on the trial tenant.
- The Flutter client is discussed in the production design but is outside the SPA-focused build.
- Migration is designed against the stated legacy hash scheme but is not run against customer data.
- The POC is not a performance or availability test for 500,000 monthly active users or event-driven peak load.
- Auth0 tenant availability and the hosted application's service levels remain those of their selected plans and providers.
