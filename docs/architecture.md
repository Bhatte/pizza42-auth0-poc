# Architecture and trust boundaries

## System context

The POC has four execution boundaries: the browser, Auth0, the Pizza 42 API, and an optional marketing destination. The SPA is public client code. It holds no client secret and is never trusted to make authorization or pricing decisions.

```mermaid
sequenceDiagram
    actor Customer
    participant SPA as React SPA
    participant Auth0 as Auth0 Universal Login
    participant API as Orders API
    participant MAPI as Auth0 Management API

    Customer->>SPA: Select items and sign in
    SPA->>Auth0: Authorization request with PKCE
    Auth0-->>SPA: Authorization code
    SPA->>Auth0: Code plus verifier
    Auth0-->>SPA: ID token and API access token
    SPA->>API: POST /api/orders with bearer token
    API->>API: Validate JWT, scope, email claim and order input
    API->>MAPI: Read and update app_metadata.orders
    MAPI-->>API: Updated profile
    API-->>SPA: Authoritative order summary
```

## Token roles

The access token authorizes calls to the Pizza 42 API. The API checks its signature, issuer, audience, expiry, and `create:orders` permission. The ID token tells the SPA about the signed-in customer and carries the exercise-specific order-history and customer-profile claims. An ID token is not accepted as API authorization.

Custom claims use a collision-resistant HTTPS namespace. The exact namespace will be frozen with the tenant name before application code is merged.

## Ordering boundary

The client sends item identifiers and quantities. The API looks up each item in its own catalogue and calculates the total. This prevents a modified browser request from setting a lower price. The API also rejects unknown items, invalid quantities, a stale or unverified email claim, and tokens without the required permission.

## Auth0 profile access

The orders service uses a machine-to-machine credential with `read:users` and `update:users_app_metadata`, not broad `update:users`. The token is cached in memory until shortly before expiry. Secrets remain in the API environment and are never returned to the SPA or written to logs.

## Marketing path

The POC exposes `POST /api/marketing/identify` and `GET /api/marketing/events` behind the same access-token validation and `read:orders` permission. The server ignores browser-supplied traits, reads the current token subject's order history, derives a Segment-shaped identify event, and keeps a bounded in-memory demonstration history. Reads are filtered by the access-token subject.

The SPA invokes the simulation independently of menu loading and checkout and treats failure as non-blocking. The production design is asynchronous: Pizza 42 domain events flow through an event bus or supported Auth0 log stream, then into Segment or Braze. Login and checkout continue if those systems are unavailable.

## HTTP boundary controls

The API applies security headers, an exact CORS origin allowlist, a 16 KiB JSON body limit, process-local request limiting, strict schemas, and safe JSON errors. These controls reduce accidental exposure and common abuse but do not replace edge rate limiting, monitoring, or a web application firewall in production.

## Production migration

The current identity store uses salted SHA-256 password hashes and cannot force two million password resets. The migration design must test two supported paths before choosing one:

- bulk import, if the existing hash format and parameters can be represented safely;
- automatic migration through a custom database connection, where the first successful legacy login moves the user to Auth0.

The proof of concept documents both paths but does not move real customer records.
