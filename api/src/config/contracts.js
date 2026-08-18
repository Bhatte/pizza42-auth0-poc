// The claim namespace is a frozen contract shared with the Post-Login Action.
// It is deliberately not configurable: changing it here without redeploying the
// Action would silently break the verified-email check on every order.
export const CLAIM_NAMESPACE = "https://pizza42.com/";

export const CLAIMS = Object.freeze({
  emailVerified: `${CLAIM_NAMESPACE}email_verified`,
});

// The bounded order contract from CONTEXT.md. The order schema enforces it and
// GET /api/meta publishes it, so the storefront and any reviewer read the same
// ceiling from one place rather than three hard-coded twenties.
export const MAX_LINE_QUANTITY = 20;
export const MAX_ORDER_LINES = 20;

export const REQUIRED_SCOPES = Object.freeze({
  "GET /api/orders": ["read:orders"],
  "POST /api/orders": ["create:orders"],
  "POST /api/marketing/identify": ["read:orders"],
  "GET /api/marketing/events": ["read:orders"],
});
