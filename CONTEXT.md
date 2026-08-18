# Pizza 42 domain context

## Domain language

- **Customer**: a Pizza 42 consumer identity represented by the access token `sub` claim. Do not call this an operator, member or account holder in product copy.
- **Menu item**: a server-owned product identified by SKU. Its name, size and price are authoritative only when read from the API catalogue.
- **Basket line**: the customer's requested SKU and quantity. It never contains an authoritative price.
- **Order**: the server-created record with a generated ID, timestamp, store, resolved menu items and EUR total.
- **Verification state**: the point-in-time boolean carried in the namespaced access-token claim. It is not a live profile lookup.
- **Order history claim**: the full `app_metadata.orders` array copied into an ID token to satisfy the POC requirement. It is not the production data model.
- **Customer profile**: derived identity and order context included in the ID token for the marketing demonstration.
- **Marketing event**: a current-customer-only, Segment-shaped demonstration payload. It is simulated and must be labelled as such.
- **Fresh token**: an access token obtained with cache bypass after the customer verifies their email.
- **Behind the counter**: the evidence panel in the authenticated storefront. It is a presenter's surface, not a customer's, and holds every term above. Do not call it a dashboard or a console in product copy.
- **Probe**: a request the evidence panel makes in order to be refused. A request that succeeds is not a probe.

## Trust rules

1. The browser expresses intent; the API establishes authority.
2. An ID token is for the client. It never authorizes an API request.
3. A valid access token is necessary but insufficient for ordering. The API also requires `create:orders` and a verified-email claim.
4. Auth0 Management API credentials remain server-side and use the narrowest available permissions.
5. Marketing availability cannot block login or checkout.

## Fixed contracts

- Claim namespace: `https://pizza42.com/`
- API audience: `https://api.pizza42.com`
- Order permissions: `create:orders` and `read:orders`
- Currency: `EUR`
- Maximum line quantity: `20`

Changes to these contracts require an explicit decision record and updates to the requirements matrix, API tests and tenant documentation.

### Why the namespace is a domain nobody dereferences

Neither `https://pizza42.com/` nor `https://api.pizza42.com` is ever fetched, resolved or verified by anything. Both are identifiers, not locations.

- **Claim namespace.** OIDC reserves the unprefixed claim space, so Auth0 requires custom claims to be namespaced as a URI to prevent collisions with standard claims. Auth0's documentation is explicit that the namespace "does not have to point to an actual resource. It is only used as an identifier; it will not be called." Auth0 additionally strips any custom claim that is _not_ namespaced, so removing the prefix would silently drop `email_verified`, `orders` and `customer_profile` from the tokens.
- **API audience.** An Auth0 API identifier is an opaque string that is conventionally, but not necessarily, URI-shaped. It is compared for equality against the `aud` claim and never requested over the network.

`pizza42.com` is the fictional customer's domain from the exercise brief, which is the appropriate choice here. Auth0 recommends a domain you control purely so that two organisations do not pick the same namespace; that is a uniqueness concern, not a security or connectivity one.

Changing either value is a coordinated breaking change, not a rename. The namespace appears in the Post-Login Action, `api/src/config/contracts.js`, the SPA claim constants and every claim-bearing test; the audience additionally exists as a tenant API identifier, so changing it means creating a new API in Auth0 and reissuing every token. Do not change either to make the string "look real".
