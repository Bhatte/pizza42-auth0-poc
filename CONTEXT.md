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
