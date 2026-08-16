// The claim namespace is a frozen contract shared with the Post-Login Action.
// It is deliberately not configurable: changing it here without redeploying the
// Action would silently break the verified-email check on every order.
export const CLAIM_NAMESPACE = "https://pizza42.com/";

export const CLAIMS = Object.freeze({
  emailVerified: `${CLAIM_NAMESPACE}email_verified`,
});
