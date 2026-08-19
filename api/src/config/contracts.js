// The claim namespace is a frozen contract shared with the Post-Login Action.
// It is deliberately not configurable: changing it here without redeploying the
// Action would silently break the verified-email check on every order.
export const CLAIM_NAMESPACE = "https://pizza42.com/";

export const CLAIMS = Object.freeze({
  emailVerified: `${CLAIM_NAMESPACE}email_verified`,
});

// The bounded order contract from CONTEXT.md. One constant the order schema
// enforces and the storefront's stepper reads, rather than hard-coded twenties
// in both places drifting apart.
export const MAX_LINE_QUANTITY = 20;
export const MAX_ORDER_LINES = 20;
