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

Decision: link a social and a database identity automatically when both carry a verified email address, and never otherwise.

Alternatives considered: linking on email equality alone; leaving the accounts separate; a user-initiated flow where the customer signs in to the second account and consents to the merge.

Why: email equality alone is not proof that two identities belong to the same person, because an unverified registration on someone else's address is free to make and linking on it hands over the account. Requiring both sides to be verified means the address has been demonstrated twice, once by each provider, which is the same evidence a consent flow would ultimately rest on. Leaving the accounts separate is safe but wrong for the customer: their order history splits in two, and the segment marketing puts them in is then derived from half of it.

Trade-off: the customer is never asked. A production flow would add explicit consent, because merging two accounts is a thing people should be told about, and would keep an audit record of every link. The Action also trusts `email_verified` as reported by the provider, which is sound for Google and would need re-examining before adding a provider that sets the flag without verifying anything.
