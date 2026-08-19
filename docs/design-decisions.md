# Design decisions

## Universal Login

Decision: use Auth0 Universal Login rather than an embedded credential form.

Alternatives considered: embedded login in the React application.

Why: credentials never enter Pizza 42 code, and database login, social login, password reset, and future passwordless methods share one hosted flow.

Trade-off: branding and unusual UX changes are constrained by the hosted experience. A custom domain may depend on the tenant plan.

## Authorization Code with PKCE

Decision: use Authorization Code with PKCE for the SPA.

Alternatives considered: implicit flow or a client secret in the browser.

Why: a SPA cannot keep a secret. PKCE binds the authorization response to the browser session that started the flow without exposing a client credential.

Trade-off: callback and silent token renewal settings must be configured precisely for each environment.

## API authorization

Decision: require a valid access token and the `create:orders` permission at the API.

Alternatives considered: checking login state in the UI or accepting an ID token.

Why: callers can bypass the SPA, and ID tokens are intended for the client application rather than an API audience.

Trade-off: local and scripted testing needs a repeatable way to obtain tokens with and without the permission.

## Verified email

Decision: add a namespaced verification claim in a Post-Login Action and enforce it in the API.

Alternatives considered: block login, trust the SPA, or query the Management API on every order.

Why: customers may sign in before verification, the API remains authoritative, and checkout does not add a Management API lookup.

Trade-off: the claim is stale until a new token is issued. The UI must request a fresh token after the customer verifies the address.

## Order storage and token history

Decision: store orders in `app_metadata.orders` and add the full history to the ID token for this exercise.

Alternatives considered: a transactional database and a bounded summary claim.

Why: both behaviours are explicit challenge requirements.

Trade-off: metadata read-modify-write is not atomic, profile size is limited, and token size grows with every order. Production would keep orders in a domain datastore and expose a bounded summary or API.

## Server-side catalogue

Decision: the API owns item names and prices; the browser submits only item identifiers and quantities.

Alternatives considered: accept the basket total calculated by the SPA.

Why: browser data is attacker-controlled. Recalculation also gives every client the same pricing rule.

Trade-off: catalogue changes require an API deployment until a proper product service is introduced.

## Marketing integration

Decision: simulate the outbound identify payload in the POC and document an asynchronous production path.

Alternatives considered: call Segment or Braze synchronously from login or checkout.

Why: a marketing outage must not stop authentication or an order.

Trade-off: the POC proves payload shape and access control, not delivery to a real campaign.

## Account linking

Decision: do not link social and database identities. A customer who uses both sign-in methods has two accounts, and the POC says so rather than hiding it.

Alternatives considered: linking whenever the email strings match; linking only when both identities carry `email_verified: true`; a user-initiated flow where the customer signs in to the second account and consents to the merge.

Why not on matching email alone: it is an account-takeover route, not a convenience. Register another person's address on the database connection, never open the verification mail, and wait — the day the real owner arrives through Google, that unverified registration's password opens their account. Email equality is not evidence that two identities share an owner.

Why not the verified-both-sides rule either, which is the correct one: requiring `email_verified` on both sides closes that hole, because the address has then been demonstrated once by each provider. It is genuinely implementable in the Post-Login Action. It is left out because doing it properly is a larger change than it looks: linking deletes the secondary user record, so order history has to be merged onto the primary before the link or it is lost; the session has to be moved onto the surviving account with `api.authentication.setPrimaryUser`, or the token is issued for a record that no longer exists; the Action needs `update:users`, which can also change an email, a password or a blocked flag, so it needs its own credential rather than the orders service's deliberately narrow one; and the `post-login` trigger fires on every silent token refresh, so the whole thing needs a guard or it adds two Management API round trips to most of the SPA's traffic. Each of those is a place to get it quietly wrong, and a POC that links accounts almost correctly is worse than one that does not link them at all.

Trade-off, stated plainly: a customer who signs up with a password and later returns through Google gets a second, empty account. Their order history is split, and the marketing segment derived from it is computed from half their orders. That is a real defect in the product and it is on the record in [known-limitations.md](known-limitations.md) rather than papered over. Production would implement the verified-both-sides rule, add explicit consent because merging someone's accounts is a thing they should be told about, and keep an audit record of every link.
